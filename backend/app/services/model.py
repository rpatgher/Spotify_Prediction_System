"""ML model inference — two cascaded layers.

Layer 1 (model_layer1_success.pkl): a RandomForestRegressor that predicts a
0–100 `success_score` from 50 audio/metadata features.

Layer 2 (model_layer2_youtube.pkl): three RandomForestRegressors (Views, Likes,
Comments) that predict YouTube engagement from 50 audio/metadata features PLUS
the layer-1 score appended last as `predicted_success` (51 inputs total). The
targets were trained on log1p, so the raw output is reverted with expm1 to real
counts.

Bundles:
  layer 1: {"model": RandomForestRegressor, "features": [50 cols]}
  layer 2: {"models": {"Views","Likes","Comments"}, "features": [50 cols],
            "uses_predicted_success": True}

Both .pkl files are gitignored (too large for GitHub); they live in ml_model/
for local dev and are placed manually on the deployed server. When a model file
is missing/unloadable (e.g. CI), the corresponding output falls back: layer 1 to
a deterministic heuristic score, layer 2 to None.

`predict` takes the raw flat Essentia pool and does the per-layer feature
selection via `audio_features.select_model_features`.
"""
import hashlib
import logging
import os
import random
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from app.services import audio_features as af

# Same root-relative location audio_features uses: <root>/ml_model/
_ML_MODEL_DIR = Path(__file__).parents[3] / "ml_model"
_MODEL_L1_PATH = Path(
    os.getenv("MODEL_LAYER1_PATH", str(_ML_MODEL_DIR / "model_layer1_success.pkl"))
)
_MODEL_L2_PATH = Path(
    os.getenv("MODEL_LAYER2_PATH", str(_ML_MODEL_DIR / "model_layer2_youtube.pkl"))
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _score_to_rating(score: int) -> str:
    if score >= 60: return "A"
    if score >= 50: return "B"
    if score >= 40: return "C"
    if score >= 30: return "D"
    if score >= 18: return "E"
    return "F"


def _next_friday(min_days: int = 14, max_days: int = 45) -> str:
    d = date.today() + timedelta(days=random.randint(min_days, max_days))
    while d.weekday() != 4:  # 4 = Friday
        d += timedelta(days=1)
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    return f"Viernes, {d.day} de {meses[d.month - 1]} de {d.year}"


# ── model loading ───────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_layer1():
    """Load the layer-1 bundle once. Returns (model, feature_order) or None."""
    if not _MODEL_L1_PATH.exists():
        logging.warning(
            "Modelo capa-1 no encontrado en '%s'. Usando score heurístico de "
            "fallback. Coloca el .pkl ahí (o define MODEL_LAYER1_PATH) para "
            "inferencia real.",
            _MODEL_L1_PATH,
        )
        return None
    try:
        import joblib

        bundle = joblib.load(_MODEL_L1_PATH)
        logging.info("Modelo capa-1 cargado (%d features).", len(bundle["features"]))
        return bundle["model"], bundle["features"]
    except Exception as exc:  # missing sklearn/joblib, pickle mismatch, etc.
        logging.warning(
            "No se pudo cargar el modelo capa-1 (%s: %s). Usando score "
            "heurístico de fallback.",
            type(exc).__name__, exc,
        )
        return None


@lru_cache(maxsize=1)
def _load_layer2():
    """Load the layer-2 bundle once. Returns (models_dict, base_features) or None."""
    if not _MODEL_L2_PATH.exists():
        logging.warning(
            "Modelo capa-2 no encontrado en '%s'. Las predicciones de YouTube "
            "quedarán en null. Coloca el .pkl ahí (o define MODEL_LAYER2_PATH).",
            _MODEL_L2_PATH,
        )
        return None
    try:
        import joblib

        bundle = joblib.load(_MODEL_L2_PATH)
        logging.info(
            "Modelo capa-2 cargado (%s, %d features).",
            ", ".join(bundle["models"]), len(bundle["features"]),
        )
        return bundle["models"], bundle["features"]
    except Exception as exc:
        logging.warning(
            "No se pudo cargar el modelo capa-2 (%s: %s). YouTube → null.",
            type(exc).__name__, exc,
        )
        return None


# ── inference ───────────────────────────────────────────────────────────────────

def _heuristic_score(features: dict) -> float:
    """Deterministic 35–94 score used only when the layer-1 model is unavailable."""
    seed = repr(sorted(features.items())).encode()
    h = int(hashlib.md5(seed).hexdigest(), 16)
    return float(35 + h % 60)


def _layer1_score(flat_pool: dict) -> float:
    """Raw layer-1 success score (0–100, continuous). Feeds both the UI and layer 2."""
    spec = af.load_feature_spec(str(af._CAPA1_FEATURES_PATH))
    feats = af.select_model_features(flat_pool, spec)

    bundle = _load_layer1()
    if bundle is None:
        return _heuristic_score(feats)

    import pandas as pd

    model, order = bundle
    row = {col: float(feats.get(col, 0.0)) for col in order}
    X = pd.DataFrame([row], columns=order)  # named cols → correct order
    raw = float(model.predict(X)[0])
    return max(0.0, min(100.0, raw))


def _layer2_youtube(flat_pool: dict, predicted_success: float) -> dict:
    """Predict YouTube Views/Likes/Comments. Returns ints, or None if unavailable."""
    bundle = _load_layer2()
    if bundle is None:
        return {"views": None, "likes": None, "comments": None}

    import numpy as np
    import pandas as pd

    models, base_features = bundle
    spec = af.load_feature_spec(str(af._CAPA2_FEATURES_PATH))
    feats = af.select_model_features(flat_pool, spec)

    # Column order = the 50 base features + predicted_success appended last.
    order = list(base_features) + ["predicted_success"]
    row = {col: float(feats.get(col, 0.0)) for col in base_features}
    row["predicted_success"] = float(predicted_success)
    X = pd.DataFrame([row], columns=order)

    out: dict[str, int] = {}
    for label, mdl in models.items():  # "Views", "Likes", "Comments"
        raw = float(mdl.predict(X)[0])           # log1p scale
        out[label.lower()] = int(round(max(0.0, float(np.expm1(raw)))))  # → real count

    return {"views": out["views"], "likes": out["likes"], "comments": out["comments"]}


# ── Public API ────────────────────────────────────────────────────────────────

def predict(flat_pool: dict, seed: str = "") -> dict:
    """Run both layers on a raw Essentia pool and return the full result payload.

    Layer 1 → success score/rating. Layer 2 → expected YouTube engagement.
    `features` is populated from the Essentia pool (Tempo + Key).
    """
    raw_score = _layer1_score(flat_pool)
    score = int(round(raw_score))
    youtube = _layer2_youtube(flat_pool, raw_score)

    return {
        "rating": _score_to_rating(score),
        "score": score,
        "best_release_date": _next_friday(),
        "features": af.extract_display_features(flat_pool, seed),
        "summary": "",
        "recommendations": [],
        "expected_views": youtube["views"],
        "expected_likes": youtube["likes"],
        "expected_comments": youtube["comments"],
    }
