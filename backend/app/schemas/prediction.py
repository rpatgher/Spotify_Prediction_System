"""Pydantic schemas for the prediction API.

Response field names use camelCase aliases to match the `AnalysisResult`
shape the existing frontend already consumes, so no UI changes are needed.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---- Requests ----
class PredictionCreate(BaseModel):
    """Body for both POST /predictions/youtube and /predictions/mp3."""

    url: str = Field(..., min_length=1, description="YouTube link or mp3 file URL")


# ---- Responses ----
class PredictionCreated(BaseModel):
    """Returned by the POST endpoints: only the id.

    The frontend then calls GET /predictions/{id} to read the full detail.
    """

    id: uuid.UUID


class FeatureItem(BaseModel):
    name: str
    value: str
    recommendation: str


class RecommendationItem(BaseModel):
    title: str
    description: str


class _CamelModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PredictionDetail(_CamelModel):
    id: uuid.UUID
    source: str
    input_name: str = Field(serialization_alias="inputName")
    input_url: str = Field(serialization_alias="inputValue")
    created_at: datetime = Field(serialization_alias="createdAt")
    rating: str
    score: int
    best_release_date: str = Field(serialization_alias="bestReleaseDate")
    features: list[FeatureItem]
    summary: str
    recommendations: list[RecommendationItem]
    # Layer 2: expected YouTube engagement (null if the model was unavailable).
    expected_views: int | None = Field(default=None, serialization_alias="expectedViews")
    expected_likes: int | None = Field(default=None, serialization_alias="expectedLikes")
    expected_comments: int | None = Field(default=None, serialization_alias="expectedComments")


class PredictionSummary(_CamelModel):
    """Lighter shape for the history list."""

    id: uuid.UUID
    source: str
    input_name: str = Field(serialization_alias="inputName")
    input_url: str = Field(serialization_alias="inputValue")
    created_at: datetime = Field(serialization_alias="createdAt")
    rating: str
    score: int
    best_release_date: str = Field(serialization_alias="bestReleaseDate")
