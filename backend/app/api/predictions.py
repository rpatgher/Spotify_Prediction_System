"""Prediction endpoints (all require a valid bearer token / X-Debug-User header)."""
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.prediction import (
    PredictionCreate,
    PredictionCreated,
    PredictionDetail,
    PredictionSummary,
)
from app.security.auth import get_current_user_id, require_producer
from app.services import prediction as prediction_service

router = APIRouter(prefix="/predictions", tags=["predictions"])

_AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"}


def _create(source: str, body: PredictionCreate, db: Session, user_id: str) -> PredictionCreated:
    prediction = prediction_service.create_prediction(
        db, user_id=user_id, source=source, url=body.url
    )
    return PredictionCreated(id=prediction.id)


@router.post(
    "/youtube",
    response_model=PredictionCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Predict from a YouTube link",
)
def predict_youtube(
    body: PredictionCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> PredictionCreated:
    # Returns only the id; the client then GETs /predictions/{id} for details.
    return _create("youtube", body, db, user_id)


@router.post(
    "/mp3",
    response_model=PredictionCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Predict from an uploaded audio file",
    dependencies=[Depends(require_producer)],  # subir archivos: solo rol `productor`
)
async def predict_mp3(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> PredictionCreated:
    filename = file.filename or "audio.mp3"
    if Path(filename).suffix.lower() not in _AUDIO_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sube un archivo de audio (.mp3, .wav, .flac, .m4a, .ogg, .aac).",
        )

    suffix = Path(filename).suffix or ".mp3"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(await file.read())
        tmp.close()
        prediction = prediction_service.create_prediction_from_file(
            db, user_id=user_id, file_path=tmp.name, filename=filename,
        )
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    return PredictionCreated(id=prediction.id)


@router.get(
    "",
    response_model=list[PredictionSummary],
    summary="List the current user's prediction history",
)
def list_history(
    source: str | None = Query(default=None, pattern="^(youtube|mp3)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[PredictionSummary]:
    items = prediction_service.list_predictions(
        db, user_id=user_id, source=source, limit=limit, offset=offset
    )
    return [PredictionSummary.model_validate(i) for i in items]


@router.get(
    "/{prediction_id}",
    response_model=PredictionDetail,
    summary="Get the full detail of a prediction",
)
def get_detail(
    prediction_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> PredictionDetail:
    prediction = prediction_service.get_prediction(
        db, user_id=user_id, prediction_id=prediction_id
    )
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found.")
    return PredictionDetail.model_validate(prediction)


@router.delete(
    "/{prediction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a prediction from the user's history",
)
def delete_detail(
    prediction_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> None:
    deleted = prediction_service.delete_prediction(
        db, user_id=user_id, prediction_id=prediction_id
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found.")
