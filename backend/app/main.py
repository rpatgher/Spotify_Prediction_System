"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api import health, predictions
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Unauthenticated.
app.include_router(health.router)

# Authenticated API.
app.include_router(predictions.router, prefix=settings.API_PREFIX)


Instrumentator().instrument(app).expose(app, include_in_schema=False)


@app.get("/")
def root() -> dict:
    return {"name": settings.APP_NAME, "docs": "/docs"}
