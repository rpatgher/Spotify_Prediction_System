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

    # ---- yt-dlp proxy (Mullvad SOCKS5) ----
    # Comma-separated list of SOCKS5 proxy URLs that yt-dlp routes downloads
    # through, e.g. "socks5://127.0.0.1:1080,socks5://127.0.0.1:1081".
    # One per Mullvad relay exposed by the mullvad-apisocks5 utility. A random
    # entry is chosen per download to rotate the exit IP. Empty = direct
    # connection (no proxy).
    YTDLP_PROXIES: str = ""

    # Mullvad account number (used by the mullvad daemon / mullvad-apisocks5
    # login, not by the app directly). Secret — keep it in the gitignored .env.
    MULLVAD_ACCOUNT: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def ytdlp_proxies_list(self) -> list[str]:
        return [p.strip() for p in self.YTDLP_PROXIES.split(",") if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
