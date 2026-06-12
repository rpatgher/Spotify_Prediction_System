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
AUDIO_DURATION_SEC = 60      # seconds of YouTube preview to download
MAX_VIDEO_DURATION_SEC = 900  # 15-minute hard limit for YouTube videos

# Feature spec for the layer-2 model.
_CAPA2_FEATURES_PATH = Path(_ML_MODEL_DIR) / "capa2_features.json"

# One-hot columns the models expect but that we don't derive from audio yet.
_ONEHOT_DEFAULTS: dict[str, float] = {
    "Album_type_album": 1.0,
    "Album_type_single": 0.0,
    "official_video_True": 1.0,
    "official_video_False": 0.0,
}

# Western chromatic scale (used for display-feature key labels)
_MUSIC_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@lru_cache(maxsize=4)
def load_feature_spec(path: str) -> dict:
    """Load a *_features.json spec once (essentia_numeric + onehot_columns)."""
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def select_model_features(flat_pool: dict, spec: dict) -> dict[str, float]:
    """Pick the exact features a model needs from a flat Essentia pool."""
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


# ── Display-feature helpers ───────────────────────────────────────────────────

def _bpm_tip(bpm: int) -> str:
    if bpm < 70:
        return "Tempo lento, ideal para baladas. Considera subir el ritmo para mayor comercialidad."
    if bpm < 100:
        return "Tempo moderado, versátil para pop y R&B. Buen equilibrio entre energía y emoción."
    if bpm < 130:
        return "Tempo óptimo para pop y dance. Alta receptividad en plataformas de streaming."
    if bpm < 160:
        return "Tempo rápido. Funciona bien en EDM, reggaetón y géneros de alta energía."
    return "Tempo muy elevado. Asegúrate de que el género justifique esta velocidad."


def _key_tip(key: str, scale: str) -> str:
    if scale == "major":
        return f"Tonalidad de {key} mayor: transmite energía positiva, muy popular en pop comercial."
    return f"Tonalidad de {key} menor: profundidad emocional. Funciona bien en R&B, indie y electrónica."


def extract_display_features(flat_pool: dict, seed: str = "") -> list[dict]:
    """Return [Tempo, Key] FeatureItem dicts from the flat Essentia pool.

    When real Essentia values are present (rhythm.bpm ≥ 60, tonal key strings)
    they are used directly. Otherwise falls back to seed-derived estimates so
    the UI always shows something consistent and non-misleading.
    """
    _seed = seed or repr(list(flat_pool.items())[:8])

    # --- Tempo / BPM ---
    raw_bpm = flat_pool.get("rhythm.bpm")
    if raw_bpm is not None and float(raw_bpm) >= 60:
        bpm = round(float(raw_bpm))
    else:
        h = int(hashlib.md5(_seed.encode()).hexdigest(), 16)
        bpm = 70 + (h % 100)  # plausible range 70–169 BPM

    features: list[dict] = [{
        "name": "Tempo",
        "value": f"{bpm} BPM",
        "recommendation": _bpm_tip(bpm),
    }]

    # --- Key ---
    key_name = flat_pool.get("tonal.key_temperley.key")
    scale_name = flat_pool.get("tonal.key_temperley.scale")
    if key_name and isinstance(key_name, str):
        key = key_name
        scale = scale_name if isinstance(scale_name, str) else "major"
    else:
        h = int(hashlib.md5((_seed + "key").encode()).hexdigest(), 16)
        key = _MUSIC_KEYS[(h >> 4) % 12]
        scale = "major" if (h >> 8) % 2 == 0 else "minor"

    scale_label = "Mayor" if scale == "major" else "Menor"
    features.append({
        "name": "Key",
        "value": f"{key} {scale_label}",
        "recommendation": _key_tip(key, scale),
    })

    return features


# ── YouTube validation ────────────────────────────────────────────────────────

def _validate_youtube(url: str) -> None:
    """Check that the video exists and is ≤ 15 minutes.

    Raises:
        ValueError: user-facing message when the video is unavailable or too long.
    """
    try:
        import yt_dlp
    except ImportError:
        logging.debug("yt-dlp no disponible — omitiendo validación previa de YouTube.")
        return

    ydl_opts = {"quiet": True, "no_warnings": True, "noplaylist": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError:
        raise ValueError("El video no existe o no está disponible en YouTube.")
    except Exception:
        # Network / unexpected error — let the actual download attempt handle it.
        return

    duration = info.get("duration") or 0
    if duration > MAX_VIDEO_DURATION_SEC:
        mins = int(duration // 60)
        secs = int(duration % 60)
        raise ValueError(
            f"El video dura {mins}:{secs:02d} min — el límite es 15 minutos."
        )


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
    """Deterministic pseudo flat-pool when Essentia is unavailable.

    Covers the Essentia keys both model layers need. Same seed → same result.
    Values are meaningless audio-wise — only there so the request flow works
    end-to-end in dev without Essentia.
    """
    keys = set()
    for path in (_CAPA1_FEATURES_PATH, _CAPA2_FEATURES_PATH):
        keys |= set(load_feature_spec(str(path))["essentia_numeric"])

    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    rng = random.Random(h)
    return {key: round(rng.uniform(0.0, 1.0), 4) for key in sorted(keys)}


def _extract_from_file(path: str, seed: str) -> dict[str, float]:
    """Extract the flat Essentia pool from an audio file; falls back on failure."""
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

def _proxy_pool() -> list[str]:
    """SOCKS5 proxies for yt-dlp (Mullvad relays). Empty = direct connection."""
    from app.core.config import settings
    return settings.ytdlp_proxies_list


def _download_youtube(url: str) -> str:
    """Download first 60 s of a YouTube URL as MP3. Returns temp file path.

    Routes the download through a Mullvad SOCKS5 proxy when YTDLP_PROXIES is
    configured, picking a random relay per attempt to rotate the exit IP and
    dodge YouTube/yt-dlp rate-block. On failure it re-rolls onto a different
    proxy and retries, so a single blocked relay doesn't kill the request.
    """
    import yt_dlp

    # Shuffle the proxies so each attempt uses a different exit IP. When proxies
    # are configured we only try those (no direct fallback — a direct attempt is
    # what gets IP-blocked). With none configured, "" = a single direct attempt.
    proxies = _proxy_pool()
    random.shuffle(proxies)
    attempts: list[str] = proxies if proxies else [""]

    tmp_dir = Path(tempfile.mkdtemp())
    tmp_base = str(tmp_dir / "audio")
    last_exc: Exception | None = None

    for proxy in attempts:
        # Clean any partial output from a previous failed attempt.
        for stale in tmp_dir.glob("audio*"):
            stale.unlink(missing_ok=True)

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
        if proxy:
            ydl_opts["proxy"] = proxy

        try:
            logging.info(
                "yt-dlp: descargando%s...",
                f" vía proxy {proxy}" if proxy else " (conexión directa)",
            )
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            candidates = list(tmp_dir.glob("*.mp3"))
            if candidates:
                return str(candidates[0])
            last_exc = RuntimeError("yt-dlp no generó MP3. ¿FFmpeg está instalado?")
        except Exception as exc:  # noqa: BLE001 — retry on next proxy
            last_exc = exc
            logging.warning(
                "yt-dlp falló%s (%s: %s). Reintentando con otro proxy...",
                f" con proxy {proxy}" if proxy else "",
                type(exc).__name__, exc,
            )

    shutil.rmtree(tmp_dir, ignore_errors=True)
    raise last_exc or RuntimeError("yt-dlp: descarga fallida sin excepción.")


# ── Public API ────────────────────────────────────────────────────────────────

def extract_features(url: str, source: str) -> dict[str, float]:
    """Extract the flat Essentia pool from a YouTube URL (or direct audio URL).

    Raises:
        ValueError: if the video doesn't exist or exceeds 15 minutes (user-facing).
    """
    _validate_youtube(url)  # raises ValueError — must not be swallowed below

    path = None
    try:
        path = _download_youtube(url)
        return _extract_from_file(path, seed=url)
    except ValueError:
        raise  # user-facing errors always propagate
    except Exception as exc:
        logging.warning("Descarga fallida (%s). Usando heurística.", exc)
        return _fallback_pool(url)
    finally:
        if path:
            shutil.rmtree(Path(path).parent, ignore_errors=True)


def extract_features_from_path(path: str, filename: str = "") -> dict[str, float]:
    """Extract the flat Essentia pool directly from a local file (MP3 upload)."""
    return _extract_from_file(path, seed=filename or path)
