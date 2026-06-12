"""Pydantic schemas for the prediction API.

Response field names use camelCase aliases to match the `AnalysisResult`
shape the existing frontend already consumes, so no UI changes are needed.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---- Requests ----

_YOUTUBE_HOSTS = {"www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"}


class PredictionCreate(BaseModel):
    """Body for POST /predictions/youtube."""

    url: str = Field(
        ...,
        min_length=1,
        description="YouTube URL to analyse.",
        examples=["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    )

    @field_validator("url")
    @classmethod
    def must_be_youtube(cls, v: str) -> str:
        from urllib.parse import urlparse
        parsed = urlparse(v.strip())
        if parsed.scheme not in ("http", "https") or parsed.hostname not in _YOUTUBE_HOSTS:
            raise ValueError("La URL debe ser de YouTube (youtube.com o youtu.be).")
        return v.strip()


# ---- Responses ----

class PredictionCreated(BaseModel):
    """Returned by the POST endpoints: only the id.

    The frontend then calls GET /predictions/{id} to read the full detail.
    """

    id: uuid.UUID = Field(
        description="UUID of the newly created prediction.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )


class FeatureItem(BaseModel):
    """One audio feature extracted by the ML pipeline (e.g. Key, Tempo)."""

    name: str = Field(description="Human-readable feature label.", examples=["Tempo"])
    value: str = Field(description="Formatted feature value.", examples=["128 BPM"])
    recommendation: str = Field(
        description="Actionable recommendation based on this feature.",
        examples=["El tempo es ideal para tracks de pop contemporáneo."],
    )


class RecommendationItem(BaseModel):
    title: str = Field(examples=["Lanzar con campaña previa"])
    description: str = Field(
        examples=["Publica adelantos entre 7 y 10 días antes del lanzamiento."]
    )


class _CamelModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PredictionSummary(_CamelModel):
    """Lighter shape for the history list."""

    id: uuid.UUID = Field(examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"])
    source: str = Field(
        description="Input source: `youtube` or `mp3`.",
        examples=["youtube"],
    )
    input_name: str = Field(
        serialization_alias="inputName",
        description="Human-friendly label for the input.",
        examples=["Análisis desde YouTube"],
    )
    input_url: str = Field(
        serialization_alias="inputValue",
        description="Original URL or filename.",
        examples=["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    )
    created_at: datetime = Field(
        serialization_alias="createdAt",
        description="ISO-8601 timestamp when the prediction was created.",
    )
    rating: str = Field(
        description=(
            "ML rating letter derived from the success score: "
            "A (≥90) · B (≥80) · C (≥65) · D (≥50) · E (≥35) · F (<35)."
        ),
        examples=["B"],
    )
    score: int = Field(
        description="Raw success score from the layer-1 model (0–100).",
        examples=[78],
        ge=0,
        le=100,
    )
    best_release_date: str = Field(
        serialization_alias="bestReleaseDate",
        description="Suggested release date (next Friday between 14 and 45 days from now).",
        examples=["Viernes, 20 de junio de 2026"],
    )


class PredictionDetail(PredictionSummary):
    """Full prediction payload returned by GET /predictions/{id}."""

    features: list[FeatureItem] = Field(
        description=(
            "Audio features extracted by Essentia (e.g. Key, Tempo). "
            "Empty list while the audio pipeline is not yet returning display features."
        ),
        default=[],
    )
    summary: str = Field(
        description="Human-readable summary of the prediction.",
        default="",
        examples=["La canción tiene un potencial competitivo dentro de su segmento."],
    )
    recommendations: list[RecommendationItem] = Field(
        description="Ordered list of actionable recommendations.",
        default=[],
    )
    # Layer 2: expected YouTube engagement (null if the model was unavailable).
    expected_views: int | None = Field(
        default=None,
        serialization_alias="expectedViews",
        description="Predicted YouTube views (layer-2 model). `null` if model is unavailable.",
        examples=[145000],
    )
    expected_likes: int | None = Field(
        default=None,
        serialization_alias="expectedLikes",
        description="Predicted YouTube likes. `null` if model is unavailable.",
        examples=[8700],
    )
    expected_comments: int | None = Field(
        default=None,
        serialization_alias="expectedComments",
        description="Predicted YouTube comments. `null` if model is unavailable.",
        examples=[420],
    )
