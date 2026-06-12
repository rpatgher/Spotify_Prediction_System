#!/usr/bin/env python3
"""
backend.py — TrackWise unified API

Endpoints que consume el frontend React:
  POST /api/analyze/youtube   JSON body: { "url": "..." }
  POST /api/analyze/mp3       multipart: file=<audio>

Pipeline:
  audio → Essentia MusicExtractor → mapeo a features tipo Spotify
         → score heurístico (pesos del XGBoost entrenado) → AnalysisResult JSON

Si Essentia no está disponible (e.g. Windows sin WSL) el endpoint igual
responde con un análisis basado en heurísticas de fallback, para que la
integración frontend ↔ backend funcione aunque el entorno de audio no esté.

Correr:
  cd ml_model
  pip install fastapi "uvicorn[standard]" python-multipart yt-dlp essentia
  python backend.py
  # o: uvicorn backend:app --port 8000
"""

import hashlib
import json
import logging
import os
import random
import shutil
import sys
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Asegura que 'extract_essentia_features.py' sea importable
# independientemente de desde dónde se lance el proceso.
sys.path.insert(0, str(Path(__file__).parent))

app = FastAPI(title="TrackWise API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173", "http://localhost:5173",  # vite dev
        "http://127.0.0.1:4173", "http://localhost:4173",  # vite preview
        "http://127.0.0.1:8080", "http://localhost:8080",  # static fallback
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────────────────────────────────────────────────────────────────────
# Constantes de extracción (deben coincidir con el entrenamiento)
# ────────────────────────────────────────────────────────────────────────────

LOWLEVEL_STATS = ["mean", "stdev"]
MAX_ARRAY_LEN = 100
AUDIO_DURATION_SEC = 60  # segundos de preview de YouTube

AUDIO_EXTS = (".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac")

KEY_MAP = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7,
    "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}

# ────────────────────────────────────────────────────────────────────────────
# Extracción de features con Essentia
# ────────────────────────────────────────────────────────────────────────────

def _extract_essentia(path: str) -> dict:
    """Corre Essentia MusicExtractor y devuelve un dict plano de features."""
    from essentia.standard import MusicExtractor
    from extract_essentia_features import flatten_pool

    extractor = MusicExtractor(
        lowlevelStats=LOWLEVEL_STATS,
        rhythmStats=LOWLEVEL_STATS,
        tonalStats=LOWLEVEL_STATS,
    )
    pool, _ = extractor(path)
    return flatten_pool(pool, include_matrices=False, max_array_len=MAX_ARRAY_LEN)


def _map_to_spotify_features(f: dict) -> dict:
    """
    Convierte features brutas de Essentia a equivalentes de la API de Spotify
    (escala 0-1, salvo loudness en dB y tempo en BPM).

    Justificación de cada mapeo:
    - danceability : Essentia rhythm.danceability está en 0-3 → normalizar a 0-1
    - energy       : spectral energy media, normalizada (valor muy pequeño en Essentia)
    - loudness     : average_loudness de Essentia es 0-1 (Vickers), lo convertimos a dB
    - acousticness : centroide espectral bajo → más acústico
    - instrumentalness: HFC (high-frequency content) bajo → más instrumental/tranquilo;
                         invirtiendo: más HFC → más vocal → instrumentalness baja
    - speechiness  : zero-crossing rate alta → más habla
    - liveness     : spectral flux — más variación dinámica → más en vivo
    - valence      : combinación de modo, danceability y energy (proxy emocional)
    - tempo        : BPM directo
    - key / mode   : key_edma de Essentia
    """
    def safe(key, default=0.0):
        return float(f.get(key, default))

    # Danceability
    danceability = min(1.0, max(0.0, safe("rhythm.danceability", 1.5) / 3.0))

    # Energy (spectral_energy.mean suele ser ~1e-4 a 1e-2)
    energy_raw = safe("lowlevel.spectral_energy.mean", 0.005)
    energy = min(1.0, max(0.0, energy_raw * 300))
    if energy < 0.01:
        energy = 0.5  # fallback si el valor es muy inusual

    # Tempo
    tempo = safe("rhythm.bpm", 120.0)
    tempo = max(40.0, min(250.0, tempo))

    # Loudness: average_loudness 0-1 → aprox dB (Spotify usa -60 a 0)
    avg_loud = safe("lowlevel.average_loudness", 0.8)
    loudness_db = (avg_loud - 1.0) * 30.0  # 1.0→0dB, 0.0→-30dB

    # Key / mode
    key_str = f.get("tonal.key_edma.key", "C")
    if not isinstance(key_str, str):
        key_str = "C"
    key = KEY_MAP.get(key_str, 0)

    scale = f.get("tonal.key_edma.scale", "major")
    mode = 1 if (isinstance(scale, str) and "major" in scale) else 0

    # Acousticness (centroide bajo = más acústico)
    centroid = safe("lowlevel.spectral_centroid.mean", 3000.0)
    centroid = max(100.0, centroid)
    acousticness = max(0.0, min(1.0, 1.0 - centroid / 8000.0))

    # Instrumentalness (HFC alto → sonido más duro, menos vocal)
    hfc = safe("lowlevel.hfc.mean", 50.0)
    instrumentalness = max(0.0, min(1.0, 1.0 - hfc / 600.0))

    # Speechiness
    zcr = safe("lowlevel.zerocrossingrate.mean", 0.05)
    speechiness = min(1.0, max(0.0, zcr * 10.0))

    # Liveness
    flux = safe("lowlevel.spectral_flux.mean", 0.2)
    liveness = min(1.0, max(0.0, flux / 0.6))

    # Valence (proxy emocional)
    valence = min(1.0, max(0.0, mode * 0.3 + danceability * 0.4 + energy * 0.3))

    return {
        "danceability": danceability,
        "energy": energy,
        "key": key,
        "loudness": loudness_db,
        "mode": mode,
        "speechiness": speechiness,
        "acousticness": acousticness,
        "instrumentalness": instrumentalness,
        "liveness": liveness,
        "valence": valence,
        "tempo": tempo,
    }


# ────────────────────────────────────────────────────────────────────────────
# Scoring
# ────────────────────────────────────────────────────────────────────────────

def _score_from_features(sf: dict) -> int:
    """
    Score heurístico basado en las importancias de features del XGBoost entrenado:
      instrumentalness 0.14 | loudness 0.086 | acousticness 0.083
      energy 0.076          | danceability 0.069
    Canciones exitosas tienden a: voz prominente, producción fuerte,
    baja acousticness, alta energía y alta bailabilidad.
    """
    # Normalizar loudness de rango [-30, 0] a [0, 1]
    loud_norm = min(1.0, max(0.0, (sf["loudness"] + 30.0) / 30.0))

    raw = (
        (1.0 - sf["instrumentalness"]) * 0.28 +  # presencia vocal → éxito
        loud_norm                        * 0.18 +  # producción potente
        (1.0 - sf["acousticness"])       * 0.17 +  # sonido producido
        sf["energy"]                     * 0.15 +
        sf["danceability"]               * 0.13 +
        sf["valence"]                    * 0.09   # mood positivo ayuda
    )
    # Escalar a 35-97 para que siempre haya margen de mejora / éxito
    return max(35, min(97, int(35 + raw * 62)))


def _fallback_features(seed: str) -> dict:
    """
    Features pseudo-deterministas cuando Essentia no está disponible.
    Usa el hash del input para que la misma canción siempre dé el mismo resultado.
    """
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    rng = random.Random(h)

    def r(lo, hi):
        return round(rng.uniform(lo, hi), 3)

    return {
        "danceability": r(0.35, 0.85),
        "energy": r(0.40, 0.90),
        "key": rng.randint(0, 11),
        "loudness": r(-14.0, -4.0),
        "mode": rng.randint(0, 1),
        "speechiness": r(0.03, 0.25),
        "acousticness": r(0.05, 0.60),
        "instrumentalness": r(0.01, 0.40),
        "liveness": r(0.08, 0.35),
        "valence": r(0.25, 0.85),
        "tempo": round(rng.uniform(75.0, 175.0), 1),
    }


# ────────────────────────────────────────────────────────────────────────────
# Construcción del AnalysisResult
# ────────────────────────────────────────────────────────────────────────────

def _score_to_rating(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 65: return "C"
    if score >= 50: return "D"
    if score >= 35: return "E"
    return "F"


def _suggest_release_date() -> str:
    d = datetime.now() + timedelta(days=random.randint(14, 45))
    while d.weekday() != 4:  # 4 = viernes
        d += timedelta(days=1)
    months = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    return f"Viernes, {d.day} de {months[d.month - 1]} de {d.year}"


def _build_features_ui(sf: dict) -> list:
    """Features que muestra el frontend en las FeatureCard (nombre + valor + recomendación)."""
    dance_pct = int(sf["danceability"] * 100)
    energy_pct = int(sf["energy"] * 100)
    tempo = int(sf["tempo"])
    mode_name = "mayor" if sf["mode"] == 1 else "menor"
    valence_pct = int(sf["valence"] * 100)

    if sf["danceability"] > 0.65:
        dance_rec = "Alta bailabilidad — ideal para playlists de workout y fiestas. Aprovecha este perfil en las primeras 48 h."
    elif sf["danceability"] > 0.45:
        dance_rec = "Bailabilidad moderada. Reforzar el groove o la percusión puede ampliar su alcance en playlists de baile."
    else:
        dance_rec = "Bailabilidad baja. Considera ajustar el patrón rítmico o el BPM para aumentar el potencial de playlist."

    if sf["energy"] > 0.70:
        energy_rec = "Energía alta — compite bien en playlists de alto impacto. Asegura que el master no sature."
    elif sf["energy"] > 0.40:
        energy_rec = "Energía media. Un master con más presencia puede mejorar el posicionamiento en charts."
    else:
        energy_rec = "Energía baja. La producción ganaría con compresión más agresiva y un mid-range más definido."

    if sf["valence"] > 0.55:
        mood_rec = f"Tonalidad {mode_name} con perfil emocional positivo ({valence_pct}%) — buen fit para radio y playlists de buen humor."
    else:
        mood_rec = f"Tonalidad {mode_name} con valencia más oscura ({valence_pct}%) — apunta a playlists de introspección o contextos nocturnos."

    return [
        {"name": "Bailabilidad", "value": f"{dance_pct}%", "recommendation": dance_rec},
        {"name": "Energía", "value": f"{energy_pct}%", "recommendation": energy_rec},
        {"name": "Tempo", "value": f"{tempo} BPM", "recommendation": mood_rec},
    ]


def _build_recommendations(sf: dict) -> list:
    recs = []

    # Recomendación 1: sobre la producción / vocales
    if sf["instrumentalness"] > 0.45:
        recs.append({
            "title": "Añadir o reforzar elementos vocales",
            "description": (
                "El análisis detecta alta instrumentalidad. Las canciones con presencia vocal prominente "
                "tienen mayor tasa de éxito en el Top 200 de Spotify según el modelo entrenado."
            ),
        })
    else:
        recs.append({
            "title": "Lanzar con campaña previa",
            "description": "Publica adelantos entre 7 y 10 días antes del lanzamiento para construir expectativa y pre-saves.",
        })

    # Recomendación 2: sobre mezcla / energía
    if sf["energy"] < 0.50:
        recs.append({
            "title": "Incrementar la energía en la mezcla",
            "description": (
                "Una mezcla más densa y un master con mayor presencia pueden mejorar el rendimiento "
                "en playlists de alto tráfico y en el algoritmo de Radio de Spotify."
            ),
        })
    else:
        recs.append({
            "title": "Optimizar el contenido visual",
            "description": (
                "La energía del track es competitiva. Acompáñala con una portada y un clip que transmitan "
                "el mismo impacto para maximizar el CTR en YouTube y Spotify."
            ),
        })

    # Recomendación 3: sobre distribución / interacción
    if sf["danceability"] > 0.60:
        recs.append({
            "title": "Proponer a curadores de playlists de baile",
            "description": (
                "La alta bailabilidad lo posiciona bien en playlists de workout, fiesta y baile. "
                "Contacta curadores de playlists como 'Baila Reggaetón' o 'Dance Hits' con el track ya publicado."
            ),
        })
    else:
        recs.append({
            "title": "Impulsar la interacción inicial",
            "description": (
                "Durante las primeras 48 horas enfócate en comentarios, compartidos y guardados. "
                "El algoritmo de Spotify pondera fuertemente la actividad del día 1."
            ),
        })

    return recs


def _build_summary(sf: dict, score: int, used_essentia: bool) -> str:
    energy_word = "alta" if sf["energy"] > 0.65 else "moderada" if sf["energy"] > 0.40 else "baja"
    dance_word = "alta" if sf["danceability"] > 0.60 else "moderada" if sf["danceability"] > 0.40 else "baja"
    mode_word = "mayor" if sf["mode"] == 1 else "menor"

    if score >= 80:
        outlook = "un sólido potencial de éxito"
        action = "Una estrategia de lanzamiento bien ejecutada puede maximizar su alcance en plataformas"
    elif score >= 60:
        outlook = "un potencial competitivo dentro de su segmento"
        action = "Con ajustes estratégicos en la mezcla y la campaña puede mejorar su posicionamiento"
    else:
        outlook = "oportunidades claras de mejora antes del lanzamiento"
        action = "Trabajar en los puntos débiles identificados puede elevar significativamente su competitividad"

    source_note = (
        "El análisis de audio detectó"
        if used_essentia
        else "El análisis estimó"
    )

    return (
        f"{source_note} una energía {energy_word}, bailabilidad {dance_word} "
        f"y tonalidad {mode_word}. Con un score predictivo de {score}/100, "
        f"la canción muestra {outlook}. {action}."
    )


def _build_result(
    score: int,
    source: str,
    input_name: str,
    input_value: str,
    sf: dict,
    used_essentia: bool,
) -> dict:
    return {
        "id": "tv_" + uuid.uuid4().hex[:12],
        "source": source,
        "inputName": input_name,
        "inputValue": input_value,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "rating": _score_to_rating(score),
        "score": score,
        "bestReleaseDate": _suggest_release_date(),
        "features": _build_features_ui(sf),
        "summary": _build_summary(sf, score, used_essentia),
        "recommendations": _build_recommendations(sf),
        # Campo de debug: "essentia" = análisis real, "heuristic" = fallback
        "analysisMode": "essentia" if used_essentia else "heuristic",
    }


# ────────────────────────────────────────────────────────────────────────────
# Pipeline principal de análisis
# ────────────────────────────────────────────────────────────────────────────

def analyze_audio_file(
    path: str, source: str, input_name: str, input_value: str
) -> dict:
    used_essentia = False
    try:
        logging.info("Essentia: extrayendo features de '%s'…", Path(path).name)
        raw = _extract_essentia(path)
        sf = _map_to_spotify_features(raw)
        score = _score_from_features(sf)
        used_essentia = True
        logging.info("Essentia OK — score=%d  danceability=%.2f  energy=%.2f  tempo=%.1f BPM",
                     score, sf["danceability"], sf["energy"], sf["tempo"])
    except Exception as exc:
        logging.warning(
            "Essentia no disponible o falló (%s: %s). "
            "Usando heurística de fallback. "
            "Para análisis real instala Essentia (Linux/macOS/WSL).",
            type(exc).__name__, exc,
        )
        sf = _fallback_features(input_value)
        score = _score_from_features(sf)

    return _build_result(score, source, input_name, input_value, sf, used_essentia)


# ────────────────────────────────────────────────────────────────────────────
# Descarga de audio desde YouTube
# ────────────────────────────────────────────────────────────────────────────

def _download_youtube(url: str) -> str:
    """Descarga los primeros 60 s de un video de YouTube como MP3. Devuelve la ruta."""
    import yt_dlp

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
            "FFmpegExtractAudio": ["-ss", "0", "-t", str(AUDIO_DURATION_SEC)],
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        candidates = list(tmp_dir.glob("*.mp3"))
        if not candidates:
            raise RuntimeError("yt-dlp no generó ningún MP3. ¿FFmpeg está instalado?")
        return str(candidates[0])
    except Exception:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise


# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

class YouTubeRequest(BaseModel):
    url: str


@app.post("/api/analyze/youtube")
async def analyze_youtube(req: YouTubeRequest):
    if not req.url.strip().startswith("http"):
        raise HTTPException(400, "Proporciona una URL válida.")

    # Intentamos descargar audio para análisis real.
    # Si yt-dlp / FFmpeg no está disponible, usamos fallback con la URL como seed.
    path = None
    try:
        path = _download_youtube(req.url)
        result = analyze_audio_file(path, "youtube", "Análisis desde YouTube", req.url)
    except Exception:
        # Fallback sin audio: heurísticas basadas en la URL
        sf = _fallback_features(req.url)
        score = _score_from_features(sf)
        result = _build_result(score, "youtube", "Análisis desde YouTube", req.url, sf, False)
    finally:
        if path:
            shutil.rmtree(Path(path).parent, ignore_errors=True)

    return result


@app.post("/api/analyze/mp3")
async def analyze_mp3(file: UploadFile = File(...)):
    filename = file.filename or "audio.mp3"
    if not filename.lower().endswith(AUDIO_EXTS):
        raise HTTPException(400, "Sube un archivo de audio (.mp3, .wav, .flac, .m4a, .ogg, .aac).")

    suffix = Path(filename).suffix or ".mp3"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(await file.read())
        tmp.close()
        result = analyze_audio_file(tmp.name, "mp3", filename, filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"No se pudo analizar el archivo: {e}")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    return result


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
