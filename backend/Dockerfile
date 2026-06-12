FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# ffmpeg is required by yt-dlp for audio post-processing.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Build context is the repo root (see docker-compose.prod.yml).
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ml_model/ must be at /ml_model so audio_features.py can locate it
# via Path(__file__).parents[3] (i.e. /app/app/services/../../.. -> /).
COPY ml_model/ /ml_model/
COPY backend/ /app/

EXPOSE 8000

# Run migrations, then start the API.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
