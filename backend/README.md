# TrackWise Backend (FastAPI)

API que orquesta el flujo de predicción de éxito musical:
`url → extracción de audio features → modelo ML → resultado persistido en DB`.

> Estado actual: la extracción de features y el modelo ML están **stubbed**
> (valores hard-coded). Los seams están marcados con `TODO` / `PLACEHOLDER`
> para conectar la función real y el XGBoost cuando estén listos.

## Stack

- **FastAPI** + Uvicorn
- **SQLAlchemy 2** + **Alembic** (PostgreSQL)
- **Pydantic v2** (schemas / validación)
- **PyJWT** (validación de tokens de Keycloak)
- **pytest**

## Estructura

```
app/
  main.py            # app FastAPI, CORS, routers
  core/config.py     # settings desde .env
  api/               # routers: health, predictions
  schemas/           # Pydantic (request/response, camelCase para el front)
  models/            # ORM: tabla predictions
  db/                # engine, sesión, Base
  services/
    audio_features.py  # SEAM: tu función de extracción (stub)
    model.py           # PLACEHOLDER: resultado hard-coded
    prediction.py      # orquestación + persistencia
  security/auth.py   # validación JWT Keycloak -> user_id
alembic/             # migraciones
tests/               # pytest (SQLite en memoria, auth override)
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET`  | `/health` | Healthcheck (sin auth) |
| `POST` | `/api/predictions/youtube` | Crea predicción desde link de YouTube → `201 { id }` |
| `POST` | `/api/predictions/mp3` | Crea predicción desde URL de mp3 → `201 { id }` |
| `GET`  | `/api/predictions/{id}` | Detalle completo (shape `AnalysisResult`) |
| `GET`  | `/api/predictions` | Historial del usuario (`?source=`, `?limit=`, `?offset=`) |
| `DELETE` | `/api/predictions/{id}` | Elimina del historial |

Todos los `/api/*` requieren `Authorization: Bearer <token>`.

**Patrón POST → GET:** los POST solo regresan el `id`; el frontend luego hace
`GET /api/predictions/{id}` para leer el detalle desde la DB.

## Configuración

Copia `.env.example` a `.env` y llena lo que tengas. Las URLs que aún no
existen (Keycloak, etc.) pueden quedarse vacías por ahora.

- `DATABASE_URL` — conexión a Postgres.
- `CORS_ORIGINS` — orígenes de los frontends (coma-separados, o `*`).
- `AUTH_ENABLED` — `true` valida JWTs contra Keycloak; `false` saltea auth en
  dev (toma el user del header `X-Debug-User`).
- `KEYCLOAK_ISSUER` / `KEYCLOAK_JWKS_URL` / `KEYCLOAK_AUDIENCE` — auth real.

## Correr con Docker (recomendado)

```bash
cd backend
cp .env.example .env          # ajusta valores si quieres
docker compose up --build
# API en http://localhost:8000  ·  docs en http://localhost:8000/docs
```
El contenedor corre `alembic upgrade head` antes de arrancar.

## Correr en local (sin Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# levanta solo Postgres:
docker compose up -d db
# apunta a localhost en vez de "db":
export DATABASE_URL=postgresql+psycopg2://trackwise:trackwise@localhost:5432/trackwise
alembic upgrade head
uvicorn app.main:app --reload
```

## Tests

```bash
cd backend
pip install -r requirements.txt
pytest
```
Los tests usan SQLite en memoria y un override de auth (no tocan Postgres ni
Keycloak).

## Integración pendiente (seams)

1. **`app/services/audio_features.py`** → reemplazar el return hard-coded por la
   llamada a tu función real de extracción (YouTube/mp3 → Essentia → features).
2. **`app/services/model.py`** → reemplazar el stub por inferencia real
   (cargar XGBoost + scaler + encoders y predecir sobre los features).
