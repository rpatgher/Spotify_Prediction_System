"""Orchestration: url -> audio features -> model -> persisted Prediction."""
from urllib.parse import unquote, urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.metrics import inference_latency, inference_total
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


def _persist(db: Session, result: dict, **base) -> Prediction:
    """Build a Prediction row from a model result + base columns, and persist it."""
    prediction = Prediction(
        rating=result["rating"],
        score=result["score"],
        best_release_date=result["best_release_date"],
        summary=result["summary"],
        features=result["features"],
        recommendations=result["recommendations"],
        expected_views=result["expected_views"],
        expected_likes=result["expected_likes"],
        expected_comments=result["expected_comments"],
        **base,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction


def create_prediction(db: Session, *, user_id: str, source: str, url: str) -> Prediction:
    """Run the full pipeline and persist the result for `user_id`."""
    try:
        with inference_latency.time():
            flat_pool = audio_features.extract_features(url, source)
            result = model.predict(flat_pool, seed=url)
            prediction = _persist(
                db, result,
                user_id=user_id,
                source=source,
                input_name=_input_name(url, source),
                input_url=url,
            )
        inference_total.labels(result_class=result["rating"], status="success").inc()
        return prediction
    except Exception:
        inference_total.labels(result_class="unknown", status="error").inc()
        raise


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


def create_prediction_from_file(
    db: Session, *, user_id: str, file_path: str, filename: str
) -> Prediction:
    """Run the full pipeline for an uploaded MP3 file and persist the result."""
    try:
        with inference_latency.time():
            flat_pool = audio_features.extract_features_from_path(file_path, filename)
            result = model.predict(flat_pool, seed=filename)
            prediction = _persist(
                db, result,
                user_id=user_id,
                source="mp3",
                input_name=filename,
                input_url=filename,
            )
        inference_total.labels(result_class=result["rating"], status="success").inc()
        return prediction
    except Exception:
        inference_total.labels(result_class="unknown", status="error").inc()
        raise


def delete_prediction(db: Session, *, user_id: str, prediction_id) -> bool:
    """Delete a prediction owned by `user_id`. Returns True if something was deleted."""
    prediction = get_prediction(db, user_id=user_id, prediction_id=prediction_id)
    if prediction is None:
        return False
    db.delete(prediction)
    db.commit()
    return True
