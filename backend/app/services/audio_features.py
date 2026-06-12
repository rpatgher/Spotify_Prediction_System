"""Audio feature extraction.

Pipeline:
  YouTube URL  → yt-dlp downloads 60 s → Essentia MusicExtractor → model features
  MP3 file path               → Essentia MusicExtractor → model features

"Model features" = the exact 50 columns the layer-1 model expects
(see ml_model/capa1_features.json): 47 numeric Essentia descriptors selected
from the flattened pool, plus 3 hard-coded one-hot columns (album/official-video
metadata that we don't extract from audio yet).

If Essentia is not installed (common on Windows), falls back to deterministic
pseudo-features derived from a hash of the input, so the full request flow
works end-to-end even without a working audio environment.
"""
import hashlib
import json
import logging
import os
import random
import shutil
import sys
import tempfile
from functools import lru_cache
from pathlib import Path

# ── make extract_essentia_features.py importable ──────────────────────────────
# Directory layout: <root>/backend/app/services/ → 3 parents up → root
_ML_MODEL_DIR = str(Path(__file__).parents[3] / "ml_model")
if _ML_MODEL_DIR not in sys.path:
    sys.path.insert(0, _ML_MODEL_DIR)

# Feature spec for the layer-1 model (which Essentia keys to keep + their order).
_CAPA1_FEATURES_PATH = Path(_ML_MODEL_DIR) / "capa1_features.json"

LOWLEVEL_STATS = ["mean", "stdev"]
MAX_ARRAY_LEN = 100
AUDIO_DURATION_SEC = 60  # seconds of YouTube preview to download

# Feature spec for the layer-2 model.
_CAPA2_FEATURES_PATH = Path(_ML_MODEL_DIR) / "capa2_features.json"

# One-hot columns the models expect but that we don't derive from audio yet.
# Hard-coded for now (assume: album track — not a single — with an official
# video). Covers the columns used by both layers.
# TODO: wire real album/video metadata once available.
_ONEHOT_DEFAULTS: dict[str, float] = {
    "Album_type_album": 1.0,
    "Album_type_single": 0.0,
    "official_video_True": 1.0,
    "official_video_False": 0.0,
}


@lru_cache(maxsize=4)
def load_feature_spec(path: str) -> dict:
    """Load a *_features.json spec once (essentia_numeric + onehot_columns)."""
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def select_model_features(flat_pool: dict, spec: dict) -> dict[str, float]:
    """Pick the exact features a model needs from a flat Essentia pool.

    `spec` is a loaded *_features.json. Numeric features are read from the pool
    (0.0 if missing); one-hot columns use the hard-coded defaults above.
    Returns a dict keyed by feature name; the caller handles column ordering.
    """
    feats: dict[str, float] = {}

    found = 0
    for key in spec["essentia_numeric"]:
        if key in flat_pool:
            found += 1
        feats[key] = float(flat_pool.get(key, 0.0))

    total = len(spec["essentia_numeric"])
    if found < total:
        logging.warning(
            "select_model_features: solo %d/%d features de Essentia presentes; "
            "el resto va en 0.0 (¿config de MusicExtractor distinta al entrenamiento?).",
            found, total,
        )

    for key in spec["onehot_columns"]:
        feats[key] = float(_ONEHOT_DEFAULTS.get(key, 0.0))

    return feats


# ── Essentia extraction ───────────────────────────────────────────────────────

def _essentia_pool_to_flat(path: str) -> dict:
    """Run Essentia MusicExtractor; return flat dict via flatten_pool."""
    from essentia.standard import MusicExtractor
    from extract_essentia_features import flatten_pool  # reuse notebook's function

    extractor = MusicExtractor(
        lowlevelStats=LOWLEVEL_STATS,
        rhythmStats=LOWLEVEL_STATS,
        tonalStats=LOWLEVEL_STATS,
    )
    pool, _ = extractor(path)
    return flatten_pool(pool, include_matrices=False, max_array_len=MAX_ARRAY_LEN)


def _fallback_pool(seed: str) -> dict[str, float]:
    """
    Deterministic pseudo flat-pool when Essentia is unavailable. Covers the
    Essentia keys both model layers need. Same seed → same result, so
    re-analysing the same song is consistent. Values are meaningless audio-wise
    — only there so the request flow works end-to-end in dev without Essentia.
    """
    keys = set()
    for path in (_CAPA1_FEATURES_PATH, _CAPA2_FEATURES_PATH):
        keys |= set(load_feature_spec(str(path))["essentia_numeric"])

    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    rng = random.Random(h)
    return {key: round(rng.uniform(0.0, 1.0), 4) for key in sorted(keys)}


def _extract_from_file(path: str, seed: str) -> dict[str, float]:
    """Extract the flat Essentia pool from an audio file; falls back on failure.

    Returns the *raw* flattened pool (all descriptors); per-layer feature
    selection happens in `model.predict` via `select_model_features`.
    """
    try:
        logging.info("Essentia: extrayendo features de '%s'...", Path(path).name)
        raw = _essentia_pool_to_flat(path)
        logging.info("Essentia OK — %d descriptores extraídos.", len(raw))
        return raw
    except Exception as exc:
        logging.warning(
            "Essentia no disponible (%s: %s). "
            "Usando heurística de fallback. "
            "Para análisis real instala Essentia en Linux/macOS/WSL.",
            type(exc).__name__, exc,
        )
        return _fallback_pool(seed)


# ── YouTube download ──────────────────────────────────────────────────────────

def _download_youtube(url: str) -> str:
    """Download first 60 s of a YouTube URL as MP3. Returns temp file path."""
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
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "128"},
        ],
        "postprocessor_args": {
            "FFmpegExtractAudio": ["-ss", "0", "-t", str(AUDIO_DURATION_SEC)],
        },
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    candidates = list(tmp_dir.glob("*.mp3"))
    if not candidates:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError("yt-dlp no generó MP3. ¿FFmpeg está instalado?")
    return str(candidates[0])


# ── Public API ────────────────────────────────────────────────────────────────

def extract_features(url: str, source: str) -> dict[str, float]:
    """Extract the flat Essentia pool from a YouTube URL (or direct audio URL)."""
    path = None
    try:
        path = _download_youtube(url)
        return _extract_from_file(path, seed=url)
    except Exception as exc:
        logging.warning("Descarga fallida (%s). Usando heurística.", exc)
        return _fallback_pool(url)
    finally:
        if path:
            shutil.rmtree(Path(path).parent, ignore_errors=True)


def extract_features_from_path(path: str, filename: str = "") -> dict[str, float]:
    """Extract the flat Essentia pool directly from a local file (MP3 upload)."""
    return _extract_from_file(path, seed=filename or path)
