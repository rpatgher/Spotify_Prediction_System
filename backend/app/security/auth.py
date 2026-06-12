"""Authentication: validate Keycloak-issued JWTs and extract the user id.

The Bearer token is verified against Keycloak's JWKS endpoint (signature,
issuer, audience and expiry). The `sub` claim is used as the user id.

For local development without a Keycloak instance, set AUTH_ENABLED=false in
`.env`; the user id is then read from the `X-Debug-User` header (default
"dev-user"). This keeps the rest of the app identical in both modes.
"""
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import settings

# auto_error=False so we can return a clean 401 ourselves.
_bearer = HTTPBearer(auto_error=False)


@lru_cache
def _jwk_client() -> PyJWKClient:
    if not settings.KEYCLOAK_JWKS_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="KEYCLOAK_JWKS_URL is not configured.",
        )
    # Caches signing keys in-memory between requests.
    return PyJWKClient(settings.KEYCLOAK_JWKS_URL)


def _decode_token(token: str) -> dict:
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        options = {"verify_aud": bool(settings.KEYCLOAK_AUDIENCE)}
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.KEYCLOAK_AUDIENCE or None,
            issuer=settings.KEYCLOAK_ISSUER or None,
            options=options,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return claims


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_debug_user: str | None = Header(default=None, alias="X-Debug-User"),
) -> str:
    """FastAPI dependency that resolves the authenticated user's id."""
    # Dev bypass — no Keycloak required.
    if not settings.AUTH_ENABLED:
        return x_debug_user or "dev-user"

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = _decode_token(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no `sub` claim.",
        )
    return user_id


def get_current_user_roles(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_debug_roles: str | None = Header(default=None, alias="X-Debug-Roles"),
) -> set[str]:
    """Realm roles of the authenticated user (Keycloak `realm_access.roles`).

    Dev bypass (AUTH_ENABLED=false): roles come from the `X-Debug-Roles`
    header (comma-separated); defaults to both roles so local flows work.
    """
    if not settings.AUTH_ENABLED:
        raw = x_debug_roles if x_debug_roles is not None else "usuario,productor"
        return {r.strip() for r in raw.split(",") if r.strip()}

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = _decode_token(credentials.credentials)
    return set(claims.get("realm_access", {}).get("roles", []))


def require_producer(roles: set[str] = Depends(get_current_user_roles)) -> None:
    """Dependency: only users with the `productor` realm role may proceed."""
    if "productor" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requiere rol 'productor'.",
        )
