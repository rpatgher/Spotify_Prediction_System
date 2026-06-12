"""ORM model for a stored prediction.

The columns mirror the `AnalysisResult` shape the frontend already consumes
(see app/src/mockService.jsx) so `GET /api/predictions/{id}` can return it 1:1.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Use JSONB on Postgres, fall back to generic JSON elsewhere (e.g. SQLite tests).
JSONType = JSON().with_variant(JSONB(), "postgresql")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Owner of the prediction (Keycloak `sub` claim).
    user_id: Mapped[str] = mapped_column(String(255), index=True)

    # "youtube" | "mp3"
    source: Mapped[str] = mapped_column(String(16), index=True)

    # Human-friendly label + the original input URL.
    input_name: Mapped[str] = mapped_column(String(512))
    input_url: Mapped[str] = mapped_column(String(2048))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # ---- Model output (placeholder for now) ----
    rating: Mapped[str] = mapped_column(String(1))
    score: Mapped[int] = mapped_column()
    best_release_date: Mapped[str] = mapped_column(String(128))
    summary: Mapped[str] = mapped_column(String)
    features: Mapped[list] = mapped_column(JSONType)
    recommendations: Mapped[list] = mapped_column(JSONType)
