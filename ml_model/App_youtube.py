#!/usr/bin/env python3
import json
import os
import shutil
import tempfile
from pathlib import Path

import joblib
import numpy as np
import yt_dlp
from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse

from extract_essentia_features import flatten_pool

LOWLEVEL_STATS = ['mean', 'stdev']
MAX_ARRAY_LEN = 100
INCLUDE_MATRICES = False
AUDIO_DURATION_SEC = 60

MODEL_PATH = Path("model.pkl")
FEATURES_PATH = Path("feature_list.json")

app = FastAPI(title="YouTube URL → Essentia → Score")


def download_youtube_preview(url: str) -> str:
    tmp_dir = Path(tempfile.mkdtemp())
    tmp_base = str(tmp_dir / "audio")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": tmp_base,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "retries": 3,
        "socket_timeout": 30,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "postprocessor_args": {
            "FFmpegExtractAudio": [
                "-ss", "0",
                "-t", str(AUDIO_DURATION_SEC),
            ],
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        candidates = list(tmp_dir.glob("*.mp3"))
        if not candidates:
            raise RuntimeError("No se generó ningún MP3.")

        return str(candidates[0])

    except Exception:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise


def cleanup_temp_file(path: str):
    tmp_dir = Path(path).parent
    shutil.rmtree(tmp_dir, ignore_errors=True)


def extract_features(path: str) -> dict:
    from essentia.standard import MusicExtractor

    extractor = MusicExtractor(
        lowlevelStats=LOWLEVEL_STATS,
        rhythmStats=LOWLEVEL_STATS,
        tonalStats=LOWLEVEL_STATS,
    )

    features, _frames = extractor(path)
    return flatten_pool(features, INCLUDE_MATRICES, MAX_ARRAY_LEN)


@app.post("/extract-url")
async def extract_url(url: str = Form(...)):
    if not url.startswith("http"):
        raise HTTPException(400, "Pega una URL válida.")

    path = None

    try:
        path = download_youtube_preview(url)
        feats = extract_features(path)

        return {
            "url": url,
            "n_features": len(feats),
            "features": feats,
        }

    except Exception as e:
        raise HTTPException(500, f"No se pudo procesar la URL: {e}")

    finally:
        if path:
            cleanup_temp_file(path)


@app.post("/score-url")
async def score_url(url: str = Form(...)):
    if not (MODEL_PATH.exists() and FEATURES_PATH.exists()):
        raise HTTPException(
            503,
            "Todavía no hay modelo. Coloca model.pkl y feature_list.json junto a app_youtube.py."
        )

    path = None

    try:
        path = download_youtube_preview(url)
        feats = extract_features(path)

        model = joblib.load(MODEL_PATH)
        cols = json.loads(FEATURES_PATH.read_text(encoding="utf-8"))

        missing = [c for c in cols if c not in feats]
        x = np.array([[float(feats.get(c, 0.0)) for c in cols]], dtype=float)

        pred = float(model.predict(x)[0])
        reach_estimate = float(np.expm1(pred))

        return {
            "url": url,
            "score_log": pred,
            "reach_estimate": reach_estimate,
            "features_faltantes": len(missing),
        }

    except Exception as e:
        raise HTTPException(500, f"No se pudo calcular el score: {e}")

    finally:
        if path:
            cleanup_temp_file(path)


INDEX_HTML = """
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>YouTube → Essentia</title>
<style>
body{font-family:Arial;background:#14110d;color:#f2ebdf;padding:40px}
input{width:600px;max-width:95%;padding:12px;border-radius:8px;border:1px solid #555}
button{padding:12px 18px;margin:8px;border:0;border-radius:8px;background:#e8a13a;font-weight:bold}
pre{background:#1d1813;padding:20px;border-radius:12px;overflow:auto;max-height:500px}
</style>
</head>
<body>
<h1>YouTube URL → Essentia</h1>
<p>Pega una URL de YouTube. Se descargará un preview de 60 segundos, se extraerán features y opcionalmente se calculará score.</p>

<input id="url" placeholder="https://www.youtube.com/watch?v=...">
<br>
<button onclick="send('/extract-url')">Extraer features</button>
<button onclick="send('/score-url')">Calcular score</button>

<pre id="out">Resultado...</pre>

<script>
async function send(endpoint){
  const url = document.getElementById('url').value;
  const out = document.getElementById('out');
  out.textContent = 'Procesando...';

  const fd = new FormData();
  fd.append('url', url);

  try{
    const r = await fetch(endpoint, {method:'POST', body:fd});
    const data = await r.json();
    out.textContent = JSON.stringify(data, null, 2);
  }catch(e){
    out.textContent = e.message;
  }
}
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return INDEX_HTML


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)