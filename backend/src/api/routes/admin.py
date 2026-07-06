"""Admin Portal authentication routes.

``POST /auth/login`` validates admin credentials and returns opaque tokens for the
frontend to store; ``POST /auth/change-password`` updates the stored password hash.
Auth applies ONLY to the admin portal — no other endpoint is protected.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from src.api.dependencies import get_admin_auth_service
from src.api.models.admin import (
    AdminInfo,
    ChangePasswordRequest,
    LoginData,
    LoginRequest,
    LoginResponse,
    SimpleResponse,
    Tokens,
)
from src.api.models.common import ErrorResponse
from src.services.admin.service import AdminAuthService, AuthError

router = APIRouter(tags=["Admin - Auth"])


def _error(exc: AuthError) -> JSONResponse:
    # `message` key so the admin-frontend httpClient surfaces it (reads data.message).
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.message},
    )


@router.post(
    "/auth/login",
    response_model=LoginResponse,
    responses={401: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Administrator login.",
    description="Validates admin email/password and returns tokens on success.",
)
async def login(
    payload: LoginRequest,
    service: AdminAuthService = Depends(get_admin_auth_service),
):
    try:
        admin = await service.login(payload.email, payload.password)
    except AuthError as exc:
        return _error(exc)
    return LoginResponse(
        timestamp=datetime.now(UTC),
        data=LoginData(
            tokens=Tokens(
                accessToken=secrets.token_urlsafe(32),
                refreshToken=secrets.token_urlsafe(32),
            ),
            user=AdminInfo(email=admin.email),
        ),
    )


@router.post(
    "/auth/change-password",
    response_model=SimpleResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
    summary="Change the administrator password.",
    description=(
        "Verifies the current password and that the new password matches its "
        "confirmation, then replaces the stored hash."
    ),
)
async def change_password(
    payload: ChangePasswordRequest,
    service: AdminAuthService = Depends(get_admin_auth_service),
):
    try:
        await service.change_password(
            payload.email,
            payload.current_password,
            payload.new_password,
            payload.confirm_new_password,
        )
    except AuthError as exc:
        return _error(exc)
    return SimpleResponse(success=True, message="Password updated successfully")
