"""Application configuration, loaded from environment / `.env`."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ---- App ----
    APP_NAME: str = "TrackWise Backend"
    API_PREFIX: str = "/api"

    # ---- Database ----
    DATABASE_URL: str = "postgresql+psycopg2://trackwise:trackwise@db:5432/trackwise"

    # ---- CORS ----
    # Comma-separated list of origins, or "*" for all.
    CORS_ORIGINS: str = "*"

    # ---- Keycloak / auth ----
    AUTH_ENABLED: bool = True
    KEYCLOAK_ISSUER: str = ""
    KEYCLOAK_JWKS_URL: str = ""
    KEYCLOAK_AUDIENCE: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
