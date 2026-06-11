"""Optional local/NAS API protection."""

import secrets
from collections.abc import Awaitable, Callable

from fastapi import Request, WebSocket, status
from starlette.responses import JSONResponse, Response

from app.config import settings

AUTH_EXEMPT_PATHS = {"/api/health"}
TOKEN_QUERY_PARAM = "cvn_token"


async def require_optional_auth(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Require an operator token when CVN_AUTH_TOKEN is configured."""
    if not auth_enabled() or request.method == "OPTIONS" or request.url.path in AUTH_EXEMPT_PATHS:
        return await call_next(request)

    if request_token_valid(
        authorization=request.headers.get("authorization"),
        header_token=request.headers.get(settings.auth_header_name),
        query_token=request.query_params.get(TOKEN_QUERY_PARAM),
    ):
        return await call_next(request)

    return JSONResponse(
        {"detail": "Channel Vault NAS auth token required"},
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": "Bearer"},
    )


def websocket_token_valid(websocket: WebSocket) -> bool:
    """Validate a WebSocket token from query params or handshake headers."""
    if not auth_enabled():
        return True
    return request_token_valid(
        authorization=websocket.headers.get("authorization"),
        header_token=websocket.headers.get(settings.auth_header_name),
        query_token=websocket.query_params.get(TOKEN_QUERY_PARAM),
    )


def auth_enabled() -> bool:
    return bool(settings.auth_token.strip())


def request_token_valid(
    *,
    authorization: str | None,
    header_token: str | None,
    query_token: str | None,
) -> bool:
    expected = settings.auth_token.strip()
    if not expected:
        return True

    for candidate in (_bearer_token(authorization), header_token, query_token):
        if candidate and secrets.compare_digest(candidate, expected):
            return True
    return False


def _bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token
