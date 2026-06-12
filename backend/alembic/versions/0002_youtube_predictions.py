"""layer 2: expected YouTube engagement columns

Revision ID: 0002_youtube_predictions
Revises: 0001_initial
Create Date: 2026-06-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_youtube_predictions"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("predictions", sa.Column("expected_views", sa.Integer(), nullable=True))
    op.add_column("predictions", sa.Column("expected_likes", sa.Integer(), nullable=True))
    op.add_column("predictions", sa.Column("expected_comments", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("predictions", "expected_comments")
    op.drop_column("predictions", "expected_likes")
    op.drop_column("predictions", "expected_views")
