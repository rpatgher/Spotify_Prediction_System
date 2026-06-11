#!/usr/bin/env python3
"""
app.py — Servicio para subir un MP3 y obtener sus features de Essentia.

Usa EXACTAMENTE la misma extraccion que extract_essentia_features.py para que
las features sean 1:1 con las del entrenamiento (clave para evaluar canciones
nuevas con el modelo de ML).

Endpoints
  GET  /          Pagina para subir un archivo de audio.
  POST /extract   Recibe el audio y devuelve las features (JSON).
  POST /score     Si existen model.pkl + feature_list.json, devuelve el score.

Requisitos
  pip install fastapi "uvicorn[standard]" python-multipart essentia numpy
  (scoring opcional) pip install joblib scikit-learn pandas
  Manten app.py en la MISMA carpeta que extract_essentia_features.py.

Correr
  python app.py            # o: uvicorn app:app --port 8000
  Abre http://localhost:8000
"""
import json
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse

# --- Reusar la MISMA extraccion que el entrenamiento -------------------------
try:
    from extract_essentia_features import flatten_pool
except ImportError:
    raise SystemExit(
        "No encuentro extract_essentia_features.py. Coloca app.py en la misma "
        "carpeta que ese script para reutilizar su funcion de features.")

# IMPORTANTE: estos parametros deben ser IGUALES a los que usaste al extraer el
# dataset de entrenamiento. Si entrenaste con --include-matrices o un
# --max-array-len distinto, ajustalos aqui tambien.
LOWLEVEL_STATS = ['mean', 'stdev']
MAX_ARRAY_LEN = 100
INCLUDE_MATRICES = False

MODEL_PATH = Path('model.pkl')
FEATURES_PATH = Path('feature_list.json')

app = FastAPI(title="Extractor de features (Essentia)")


def extract_features(path: str) -> dict:
    """Corre MusicExtractor y aplana el Pool igual que en el entrenamiento."""
    from essentia.standard import MusicExtractor
    extractor = MusicExtractor(
        lowlevelStats=LOWLEVEL_STATS,
        rhythmStats=LOWLEVEL_STATS,
        tonalStats=LOWLEVEL_STATS,
    )
    features, _frames = extractor(path)
    return flatten_pool(features, INCLUDE_MATRICES, MAX_ARRAY_LEN)


def _save_temp(upload: UploadFile, data: bytes) -> str:
    suffix = Path(upload.filename or 'audio.mp3').suffix or '.mp3'
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.close()
    return tmp.name


AUDIO_EXTS = ('.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac')


@app.post('/extract')
async def extract(file: UploadFile = File(...)):
    if not (file.filename or '').lower().endswith(AUDIO_EXTS):
        raise HTTPException(400, "Sube un archivo de audio (mp3, wav, flac, m4a, ogg, aac).")
    path = _save_temp(file, await file.read())
    try:
        feats = extract_features(path)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"No se pudieron extraer las features: {e}")
    finally:
        os.unlink(path)
    return {"filename": file.filename, "n_features": len(feats), "features": feats}


@app.post('/score')
async def score(file: UploadFile = File(...)):
    if not (MODEL_PATH.exists() and FEATURES_PATH.exists()):
        raise HTTPException(
            503, "Todavia no hay modelo. Coloca model.pkl y feature_list.json junto a app.py.")
    import numpy as np
    import joblib

    model = joblib.load(MODEL_PATH)
    cols = json.loads(FEATURES_PATH.read_text(encoding='utf-8'))  # lista ordenada de columnas

    path = _save_temp(file, await file.read())
    try:
        feats = extract_features(path)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"No se pudieron extraer las features: {e}")
    finally:
        os.unlink(path)

    # Alinear al MISMO orden de columnas del entrenamiento (faltantes -> 0, extras -> fuera)
    missing = [c for c in cols if c not in feats]
    x = np.array([[float(feats.get(c, 0.0)) for c in cols]], dtype=float)
    pred = float(model.predict(x)[0])
    # Si entrenaste con log1p(target), esto lo deshace:
    reach_estimate = float(np.expm1(pred))
    return {
        "filename": file.filename,
        "score_log": pred,
        "reach_estimate": reach_estimate,
        "features_faltantes": len(missing),
    }


INDEX_HTML = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Extractor de features · Essentia</title>
<style>
  :root{
    --bg:#14110d; --panel:#1d1813; --panel-2:#241d16; --line:#3a2f24;
    --ink:#f2ebdf; --muted:#a79a85; --amber:#e8a13a; --amber-dim:#7a5a26;
    --good:#7bbf6a; --bad:#d2705a;
    --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
       line-height:1.5;-webkit-font-smoothing:antialiased}
  .wrap{max-width:860px;margin:0 auto;padding:48px 20px 80px}
  header{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--line);
         padding-bottom:18px;margin-bottom:30px}
  h1{font-size:20px;margin:0;letter-spacing:.2px;font-weight:600}
  header .tag{font-family:var(--mono);font-size:12px;color:var(--amber);
              border:1px solid var(--amber-dim);padding:2px 8px;border-radius:999px}
  header p{margin:0 0 0 auto;color:var(--muted);font-size:13px}
  .drop{border:1.5px dashed var(--line);border-radius:14px;background:var(--panel);
        padding:42px 24px;text-align:center;transition:border-color .15s,background .15s;cursor:pointer}
  .drop.hot{border-color:var(--amber);background:var(--panel-2)}
  .drop strong{display:block;font-size:16px;margin-bottom:6px}
  .drop span{color:var(--muted);font-size:13px}
  .file{margin-top:14px;font-family:var(--mono);font-size:13px;color:var(--amber)}
  .actions{display:flex;gap:10px;margin-top:18px}
  button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:11px 18px;cursor:pointer}
  .primary{background:var(--amber);color:#1a1206}
  .primary:disabled{background:var(--amber-dim);color:#2a2114;cursor:not-allowed}
  .ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
  .status{margin-top:18px;font-size:14px;min-height:22px}
  .status.err{color:var(--bad)} .status.ok{color:var(--good)}
  .results{margin-top:26px;display:none}
  .summary{display:flex;align-items:center;gap:16px;margin-bottom:14px}
  .count{font-family:var(--mono);font-size:30px;color:var(--amber);line-height:1}
  .count small{display:block;font-size:11px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase}
  .filter{margin-left:auto;background:var(--panel);border:1px solid var(--line);
          color:var(--ink);border-radius:9px;padding:8px 12px;font:inherit;font-size:13px;width:220px}
  .tbl{border:1px solid var(--line);border-radius:12px;overflow:hidden;max-height:440px;overflow-y:auto}
  table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12.5px}
  th{position:sticky;top:0;background:var(--panel-2);text-align:left;padding:9px 14px;
     color:var(--muted);font-weight:600;letter-spacing:.04em;border-bottom:1px solid var(--line)}
  td{padding:7px 14px;border-bottom:1px solid #2a2219;white-space:nowrap}
  td.k{color:var(--ink)} td.v{color:var(--amber);text-align:right}
  tr:last-child td{border-bottom:0}
  tr:hover td{background:#221b14}
  .spin{display:inline-block;width:13px;height:13px;border:2px solid var(--amber-dim);
        border-top-color:var(--amber);border-radius:50%;animation:r .7s linear infinite;vertical-align:-2px;margin-right:7px}
  @keyframes r{to{transform:rotate(360deg)}}
  @media(prefers-reduced-motion){.spin{animation:none}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Extractor de features</h1>
    <span class="tag">Essentia · MusicExtractor</span>
    <p>Sube un MP3 para ver sus descriptores de audio</p>
  </header>

  <div class="drop" id="drop">
    <strong>Arrastra un archivo de audio aqui</strong>
    <span>o haz clic para elegirlo · mp3, wav, flac, m4a, ogg</span>
    <div class="file" id="fileName"></div>
    <input type="file" id="input" accept=".mp3,.wav,.flac,.m4a,.ogg,.aac,audio/*" hidden>
  </div>

  <div class="actions">
    <button class="primary" id="btnExtract" disabled>Extraer features</button>
    <button class="ghost" id="btnScore" disabled>Calcular score</button>
    <button class="ghost" id="btnJson" disabled>Descargar JSON</button>
  </div>

  <div class="status" id="status"></div>

  <div class="results" id="results">
    <div class="summary">
      <div class="count" id="count">0<small>features</small></div>
      <input class="filter" id="filter" placeholder="filtrar por nombre...">
    </div>
    <div class="tbl">
      <table>
        <thead><tr><th>Descriptor</th><th style="text-align:right">Valor</th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
const drop=document.getElementById('drop'), input=document.getElementById('input'),
      fileName=document.getElementById('fileName'), status=document.getElementById('status'),
      btnExtract=document.getElementById('btnExtract'), btnScore=document.getElementById('btnScore'),
      btnJson=document.getElementById('btnJson'), results=document.getElementById('results'),
      count=document.getElementById('count'), rows=document.getElementById('rows'),
      filter=document.getElementById('filter');
let current=null, lastFeatures=null;

drop.onclick=()=>input.click();
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('hot');}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('hot');}));
drop.addEventListener('drop',ev=>{ if(ev.dataTransfer.files[0]) setFile(ev.dataTransfer.files[0]); });
input.onchange=()=>{ if(input.files[0]) setFile(input.files[0]); };

function setFile(f){
  current=f; fileName.textContent=f.name;
  btnExtract.disabled=false; btnScore.disabled=false;
  btnJson.disabled=true; results.style.display='none'; status.textContent='';
}
function setStatus(msg,cls){ status.className='status '+(cls||''); status.innerHTML=msg; }

async function send(endpoint){
  if(!current) return;
  btnExtract.disabled=btnScore.disabled=true;
  setStatus('<span class="spin"></span>Analizando '+current.name+'… (puede tardar unos segundos)');
  const fd=new FormData(); fd.append('file',current);
  try{
    const r=await fetch(endpoint,{method:'POST',body:fd});
    const data=await r.json();
    if(!r.ok) throw new Error(data.detail||('Error '+r.status));
    if(endpoint==='/extract'){ render(data); }
    else { setStatus('Score (log): '+data.score_log.toFixed(4)+' · estimado: '+
           Math.round(data.reach_estimate).toLocaleString()+
           (data.features_faltantes? ' · '+data.features_faltantes+' features faltantes':''),'ok'); }
  }catch(err){ setStatus(err.message,'err'); }
  finally{ btnExtract.disabled=btnScore.disabled=false; }
}
btnExtract.onclick=()=>send('/extract');
btnScore.onclick=()=>send('/score');

function render(data){
  lastFeatures=data.features; btnJson.disabled=false;
  count.innerHTML=data.n_features+'<small>features</small>';
  setStatus('Listo: '+data.filename,'ok');
  results.style.display='block'; filter.value=''; draw('');
}
function draw(q){
  const items=Object.entries(lastFeatures)
    .filter(([k])=>k.toLowerCase().includes(q.toLowerCase()));
  rows.innerHTML=items.map(([k,v])=>{
    const val=(typeof v==='number')? (Number.isInteger(v)? v : v.toFixed(4)) : v;
    return '<tr><td class="k">'+k+'</td><td class="v">'+val+'</td></tr>';
  }).join('') || '<tr><td colspan="2" style="color:var(--muted)">sin coincidencias</td></tr>';
}
filter.oninput=()=>draw(filter.value);

btnJson.onclick=()=>{
  const blob=new Blob([JSON.stringify(lastFeatures,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=(current.name.replace(/\\.[^.]+$/,''))+'_features.json'; a.click();
};
</script>
</body>
</html>"""


@app.get('/', response_class=HTMLResponse)
async def index():
    return INDEX_HTML


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)