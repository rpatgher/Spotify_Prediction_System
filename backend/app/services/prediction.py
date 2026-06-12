"""Orchestration: url -> audio features -> model -> persisted Prediction."""
from urllib.parse import unquote, urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.prediction import Prediction
from app.services import audio_features, model

_SOURCE_LABELS = {
    "youtube": "Análisis desde YouTube",
    "mp3": "Análisis desde MP3",
}


def _input_name(url: str, source: str) -> str:
    """A friendly label for the input (filename for mp3, generic for youtube)."""
    if source == "mp3":
        path = urlparse(url).path
        filename = unquote(path.rsplit("/", 1)[-1])
        if filename:
            return filename
    return _SOURCE_LABELS.get(source, "Análisis")


def create_prediction(db: Session, *, user_id: str, source: str, url: str) -> Prediction:
    """Run the full pipeline and persist the result for `user_id`."""
    features = audio_features.extract_features(url, source)  # SEAM (stubbed)
    result = model.predict(features)  # PLACEHOLDER

    prediction = Prediction(
        user_id=user_id,
        source=source,
        input_name=_input_name(url, source),
        input_url=url,
        rating=result["rating"],
        score=result["score"],
        best_release_date=result["best_release_date"],
        summary=result["summary"],
        features=result["features"],
        recommendations=result["recommendations"],
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction


def get_prediction(db: Session, *, user_id: str, prediction_id) -> Prediction | None:
    """Fetch a single prediction, scoped to its owner."""
    stmt = select(Prediction).where(
        Prediction.id == prediction_id,
        Prediction.user_id == user_id,
    )
    return db.execute(stmt).scalar_one_or_none()


def list_predictions(
    db: Session,
    *,
    user_id: str,
    source: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Prediction]:
    """List a user's predictions, newest first, optionally filtered by source."""
    stmt = select(Prediction).where(Prediction.user_id == user_id)
    if source:
        stmt = stmt.where(Prediction.source == source)
    stmt = stmt.order_by(Prediction.created_at.desc()).limit(limit).offset(offset)
    return list(db.execute(stmt).scalars().all())


def delete_prediction(db: Session, *, user_id: str, prediction_id) -> bool:
    """Delete a prediction owned by `user_id`. Returns True if something was deleted."""
    prediction = get_prediction(db, user_id=user_id, prediction_id=prediction_id)
    if prediction is None:
        return False
    db.delete(prediction)
    db.commit()
    return True
