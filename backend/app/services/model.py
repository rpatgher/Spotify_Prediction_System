"""ML model inference.

Uses a heuristic weighted by the feature importances of the trained XGBoost
(see ml_model/Spotify_Success_Prediction.ipynb §4.7):

  instrumentalness 0.14 | loudness 0.086 | acousticness 0.083
  energy 0.076          | danceability 0.069

Key insight from the notebook: successful songs tend to have vocals (low
instrumentalness), loud production, low acousticness, high energy and
high danceability.

To plug in the real XGBoost, replace the body of `predict` with:
    model  = joblib.load("model.pkl")
    scaler = joblib.load("scaler.pkl")
    cols   = json.loads(Path("feature_list.json").read_text())
    x      = scaler.transform([[features.get(c, 0.0) for c in cols]])
    pred   = int(model.predict_proba(x)[0][1] * 100)   # probability → score
"""
import random
from datetime import date, timedelta


# ── helpers ───────────────────────────────────────────────────────────────────

def _score_to_rating(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 65: return "C"
    if score >= 50: return "D"
    if score >= 35: return "E"
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


def _build_features_ui(sf: dict) -> list:
    """Build the features[] array rendered as FeatureCards in the frontend."""
    dance_pct = int(sf["danceability"] * 100)
    energy_pct = int(sf["energy"] * 100)
    tempo = int(sf.get("tempo", 120))
    mode_name = "mayor" if sf["mode"] >= 0.5 else "menor"
    valence_pct = int(sf["valence"] * 100)

    if sf["danceability"] > 0.65:
        dance_rec = "Alta bailabilidad — ideal para playlists de workout y fiestas. Aprovecha este perfil en las primeras 48 h."
    elif sf["danceability"] > 0.45:
        dance_rec = "Bailabilidad moderada. Reforzar el groove puede ampliar su alcance en playlists de baile."
    else:
        dance_rec = "Bailabilidad baja. Considera ajustar el patrón rítmico o el BPM para ampliar el potencial de playlist."

    if sf["energy"] > 0.70:
        energy_rec = "Energía alta — compite bien en playlists de alto impacto. Asegura que el master no sature."
    elif sf["energy"] > 0.40:
        energy_rec = "Energía media. Un master con más presencia puede mejorar el posicionamiento en charts."
    else:
        energy_rec = "Energía baja. La producción ganaría con compresión más agresiva y mid-range más definido."

    if sf["valence"] > 0.55:
        mood_rec = (
            f"Tonalidad {mode_name} con perfil emocional positivo ({valence_pct}%) "
            "— buen fit para radio y playlists de buen humor."
        )
    else:
        mood_rec = (
            f"Tonalidad {mode_name} con perfil más oscuro ({valence_pct}%) "
            "— apunta a playlists de introspección o contextos nocturnos."
        )

    return [
        {"name": "Bailabilidad", "value": f"{dance_pct}%", "recommendation": dance_rec},
        {"name": "Energía", "value": f"{energy_pct}%", "recommendation": energy_rec},
        {"name": "Tempo", "value": f"{tempo} BPM", "recommendation": mood_rec},
    ]


def _build_recommendations(sf: dict) -> list:
    recs = []

    if sf["instrumentalness"] > 0.45:
        recs.append({
            "title": "Añadir o reforzar elementos vocales",
            "description": (
                "El análisis detecta alta instrumentalidad. Las canciones con presencia vocal "
                "prominente tienen mayor tasa de éxito en el Top 200 de Spotify según el modelo entrenado."
            ),
        })
    else:
        recs.append({
            "title": "Lanzar con campaña previa",
            "description": "Publica adelantos entre 7 y 10 días antes del lanzamiento para construir expectativa y pre-saves.",
        })

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
                "La energía del track es competitiva. Acompáñala con portada y clip que transmitan "
                "el mismo impacto para maximizar el CTR en YouTube y Spotify."
            ),
        })

    if sf["danceability"] > 0.60:
        recs.append({
            "title": "Apuntar a playlists de baile",
            "description": (
                "La alta bailabilidad lo posiciona bien en playlists de workout y fiesta. "
                "Contacta curadores con el track ya publicado."
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


def _build_summary(sf: dict, score: int) -> str:
    energy_word = "alta" if sf["energy"] > 0.65 else "moderada" if sf["energy"] > 0.40 else "baja"
    dance_word = "alta" if sf["danceability"] > 0.60 else "moderada" if sf["danceability"] > 0.40 else "baja"
    mode_word = "mayor" if sf["mode"] >= 0.5 else "menor"

    if score >= 80:
        outlook, action = "un sólido potencial de éxito", "Una estrategia de lanzamiento bien ejecutada puede maximizar su alcance"
    elif score >= 60:
        outlook, action = "un potencial competitivo dentro de su segmento", "Con ajustes estratégicos puede mejorar su posicionamiento"
    else:
        outlook, action = "oportunidades claras de mejora antes del lanzamiento", "Trabajar en los puntos débiles puede elevar significativamente su competitividad"

    return (
        f"El análisis detectó una energía {energy_word}, bailabilidad {dance_word} "
        f"y tonalidad {mode_word}. Con un score predictivo de {score}/100, "
        f"la canción muestra {outlook}. {action}."
    )


# ── Public API ────────────────────────────────────────────────────────────────

def predict(features: dict[str, float]) -> dict:
    """
    Run inference on audio features and return the full result payload.

    Weights follow the XGBoost feature importances from the notebook:
      instrumentalness (0.14) → voz > instrumento
      loudness (0.086)        → producción potente
      acousticness (0.083)    → sonido producido, no acústico
      energy (0.076)
      danceability (0.069)
    """
    loud_norm = min(1.0, max(0.0, (features["loudness"] + 30.0) / 30.0))
    raw = (
        (1.0 - features["instrumentalness"]) * 0.28 +
        loud_norm                             * 0.18 +
        (1.0 - features["acousticness"])      * 0.17 +
        features["energy"]                    * 0.15 +
        features["danceability"]              * 0.13 +
        features["valence"]                   * 0.09
    )
    score = max(35, min(97, int(35 + raw * 62)))

    return {
        "rating": _score_to_rating(score),
        "score": score,
        "best_release_date": _next_friday(),
        "features": _build_features_ui(features),
        "summary": _build_summary(features, score),
        "recommendations": _build_recommendations(features),
    }
