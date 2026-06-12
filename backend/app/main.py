"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api import health, predictions
from app.core.config import settings

_DESCRIPTION = """
## TrackWise Backend API

Predice el potencial de éxito de una canción en Spotify y el engagement esperado en YouTube
usando dos capas de modelos Random Forest entrenados con features de audio (Essentia).

### Capas del modelo

| Capa | Input | Output |
|------|-------|--------|
| **Layer 1** | 50 features de audio | `score` (0–100) + `rating` (A–F) |
| **Layer 2** | features de audio + score de capa 1 | `expectedViews`, `expectedLikes`, `expectedComments` |

### Autenticación

Todos los endpoints de predicción requieren un **Bearer JWT** emitido por Keycloak.

**Modo desarrollo** (`AUTH_ENABLED=false`): en lugar del token usa el header
`X-Debug-User: <user-id>`. Para endpoints de productor añade `X-Debug-Roles: productor`.

### Roles

- `usuario` — puede analizar desde YouTube y consultar su historial.
- `productor` — además puede subir archivos de audio (MP3/WAV/FLAC/…).
"""

app = FastAPI(
    title=settings.APP_NAME,
    description=_DESCRIPTION,
    version="1.0.0",
    contact={"name": "TrackWise Team"},
    openapi_tags=[
        {
            "name": "health",
            "description": "Healthcheck sin autenticación. Útil para probes de Kubernetes / Docker.",
        },
        {
            "name": "predictions",
            "description": (
                "Crear, consultar y eliminar predicciones. "
                "Todos los recursos están aislados por usuario (`sub` del JWT)."
            ),
        },
    ],
)

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
