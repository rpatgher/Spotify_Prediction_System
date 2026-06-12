"""ML model inference — PLACEHOLDER.

The trained model (XGBoost, see ml_model/) is not served yet. This module
returns a hard-coded result with the SAME shape the real model output will be
mapped to, so the API and frontend can be built and tested end to end.

When the model is ready, replace `predict` so it loads the model + scaler +
encoders and runs real inference on the extracted audio features.
"""
from datetime import date, timedelta

# Marketing-style display features the frontend's results screen renders.
# Kept aligned with app/src/constants.jsx DEFAULT_FEATURES.
_DEFAULT_FEATURES = [
    {
        "name": "Reproducciones estimadas",
        "value": "120K - 250K",
        "recommendation": "Aumentar expectativa con campaña previa en redes sociales.",
    },
    {
        "name": "Vistas potenciales en YouTube",
        "value": "80K - 180K",
        "recommendation": "Crear teaser visual y usar miniatura llamativa.",
    },
    {
        "name": "Engagement esperado",
        "value": "7.8%",
        "recommendation": "Impulsar comentarios, guardados y compartidos durante los primeros días.",
    },
]

_DEFAULT_RECOMMENDATIONS = [
    {
        "title": "Lanzar con campaña previa",
        "description": "Publica adelantos entre 7 y 10 días antes del lanzamiento.",
    },
    {
        "title": "Optimizar contenido visual",
        "description": "Utiliza una portada y miniatura que comuniquen claramente el mood de la canción.",
    },
    {
        "title": "Impulsar interacción inicial",
        "description": "Durante las primeras 48 horas, enfócate en comentarios, compartidos y guardados.",
    },
]

_DEFAULT_SUMMARY = (
    "De acuerdo con la información procesada, la canción tiene un potencial "
    "competitivo dentro de su segmento. Las métricas muestran una buena "
    "posibilidad de alcance si se acompaña de una estrategia de lanzamiento "
    "constante, contenido visual atractivo y promoción previa."
)


def _next_friday(min_days_ahead: int = 21) -> str:
    """A Friday at least `min_days_ahead` days from today (es-ES, capitalized)."""
    d = date.today() + timedelta(days=min_days_ahead)
    while d.weekday() != 4:  # 4 = Friday
        d += timedelta(days=1)
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    return f"{dias[d.weekday()]}, {d.day} de {meses[d.month - 1]} de {d.year}"


def predict(features: dict[str, float]) -> dict:
    """Run inference on audio features and return a result payload.

    Args:
        features: audio-feature mapping from `audio_features.extract_features`.

    Returns:
        dict with: rating ("A".."F"), score (0-100), best_release_date,
        features (display list), summary, recommendations.

    NOTE: this is a hard-coded stub. `features` is intentionally ignored for
    now. Replace the body with real XGBoost inference when the model is served.
    """
    # --- HARD-CODED PLACEHOLDER ---
    score = 82
    rating = "B"
    return {
        "rating": rating,
        "score": score,
        "best_release_date": _next_friday(),
        "features": _DEFAULT_FEATURES,
        "summary": _DEFAULT_SUMMARY,
        "recommendations": _DEFAULT_RECOMMENDATIONS,
    }
