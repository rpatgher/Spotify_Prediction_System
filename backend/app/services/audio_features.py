"""Audio feature extraction.

Pipeline:
  YouTube URL  → yt-dlp downloads 60 s → Essentia MusicExtractor → Spotify-like features
  MP3 file path               → Essentia MusicExtractor → Spotify-like features

If Essentia is not installed (common on Windows), falls back to deterministic
pseudo-features derived from a hash of the input, so the full request flow
works end-to-end even without a working audio environment.
"""
import hashlib
import logging
import os
import random
import shutil
import sys
import tempfile
from pathlib import Path

# ── make extract_essentia_features.py importable ──────────────────────────────
# Directory layout: Spotify_Prediction_System/backend/app/services/ → 3 parents up → root
_ML_MODEL_DIR = str(Path(__file__).parents[3] / "ml_model")
if _ML_MODEL_DIR not in sys.path:
    sys.path.insert(0, _ML_MODEL_DIR)

LOWLEVEL_STATS = ["mean", "stdev"]
MAX_ARRAY_LEN = 100
AUDIO_DURATION_SEC = 60  # seconds of YouTube preview to download

AUDIO_FEATURE_KEYS = [
    "danceability", "energy", "key", "loudness", "mode",
    "speechiness", "acousticness", "instrumentalness", "liveness", "valence",
]

_KEY_MAP = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7,
    "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11,
}


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


def _map_to_spotify_features(f: dict) -> dict[str, float]:
    """
    Convert Essentia's flat feature dict to the 10 Spotify-like features
    the model was trained on.

    Mapping rationale:
    - danceability   : rhythm.danceability (0–3) → normalised to 0–1
    - energy         : spectral_energy.mean (tiny float) → scaled
    - loudness       : average_loudness (0–1 Vickers) → approx dB
    - acousticness   : inverse spectral centroid (low centroid = more acoustic)
    - instrumentalness: inverse HFC (high-freq content low = more instrumental)
    - speechiness    : zero-crossing rate (high = more speech-like)
    - liveness       : spectral flux (more variation = more live)
    - valence        : proxy from mode + danceability + energy
    - key/mode       : key_edma
    - tempo          : BPM from rhythm.bpm
    """
    def _s(key, default=0.0):
        return float(f.get(key, default))

    danceability = min(1.0, max(0.0, _s("rhythm.danceability", 1.5) / 3.0))
    energy = min(1.0, max(0.01, _s("lowlevel.spectral_energy.mean", 0.005) * 300))
    tempo = max(40.0, min(250.0, _s("rhythm.bpm", 120.0)))
    loudness = (_s("lowlevel.average_loudness", 0.8) - 1.0) * 30.0  # → approx dB
    key = _KEY_MAP.get(str(f.get("tonal.key_edma.key", "C")), 0)
    scale = f.get("tonal.key_edma.scale", "major")
    mode = 1.0 if (isinstance(scale, str) and "major" in scale) else 0.0
    centroid = max(100.0, _s("lowlevel.spectral_centroid.mean", 3000.0))
    acousticness = max(0.0, min(1.0, 1.0 - centroid / 8000.0))
    instrumentalness = max(0.0, min(1.0, 1.0 - _s("lowlevel.hfc.mean", 50.0) / 600.0))
    speechiness = min(1.0, max(0.0, _s("lowlevel.zerocrossingrate.mean", 0.05) * 10.0))
    liveness = min(1.0, max(0.0, _s("lowlevel.spectral_flux.mean", 0.2) / 0.6))
    valence = min(1.0, max(0.0, mode * 0.3 + danceability * 0.4 + energy * 0.3))

    return {
        "danceability": danceability,
        "energy": energy,
        "key": float(key),
        "loudness": loudness,
        "mode": mode,
        "speechiness": speechiness,
        "acousticness": acousticness,
        "instrumentalness": instrumentalness,
        "liveness": liveness,
        "valence": valence,
        "tempo": tempo,
    }


def _fallback_features(seed: str) -> dict[str, float]:
    """
    Deterministic pseudo-features when Essentia is unavailable.
    Same seed → same result, so re-analysing the same song gives consistent output.
    """
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    rng = random.Random(h)

    def r(lo: float, hi: float) -> float:
        return round(rng.uniform(lo, hi), 3)

    return {
        "danceability": r(0.35, 0.85),
        "energy": r(0.40, 0.90),
        "key": float(rng.randint(0, 11)),
        "loudness": r(-14.0, -4.0),
        "mode": float(rng.randint(0, 1)),
        "speechiness": r(0.03, 0.25),
        "acousticness": r(0.05, 0.60),
        "instrumentalness": r(0.01, 0.40),
        "liveness": r(0.08, 0.35),
        "valence": r(0.25, 0.85),
        "tempo": round(rng.uniform(75.0, 175.0), 1),
    }


def _extract_from_file(path: str, seed: str) -> dict[str, float]:
    """Extract features from an audio file; falls back to heuristics on failure."""
    try:
        logging.info("Essentia: extrayendo features de '%s'...", Path(path).name)
        raw = _essentia_pool_to_flat(path)
        features = _map_to_spotify_features(raw)
        logging.info(
            "Essentia OK — danceability=%.2f  energy=%.2f  tempo=%.1f BPM",
            features["danceability"], features["energy"], features["tempo"],
        )
        return features
    except Exception as exc:
        logging.warning(
            "Essentia no disponible (%s: %s). "
            "Usando heurística de fallback. "
            "Para análisis real instala Essentia en Linux/macOS/WSL.",
            type(exc).__name__, exc,
        )
        return _fallback_features(seed)


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
    """Extract audio features from a YouTube URL (or any direct audio URL)."""
    path = None
    try:
        path = _download_youtube(url)
        return _extract_from_file(path, seed=url)
    except Exception as exc:
        logging.warning("Descarga fallida (%s). Usando heurística.", exc)
        return _fallback_features(url)
    finally:
        if path:
            shutil.rmtree(Path(path).parent, ignore_errors=True)


def extract_features_from_path(path: str, filename: str = "") -> dict[str, float]:
    """Extract audio features directly from a local file path (MP3 upload)."""
    return _extract_from_file(path, seed=filename or path)
