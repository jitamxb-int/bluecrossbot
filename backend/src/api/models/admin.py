"""Models for the Admin Portal authentication API.

The login response uses the envelope the admin-frontend expects
(``data.tokens.accessToken`` + ``data.user``). Token field names are camelCase to
match the frontend token storage contract.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(..., description="Administrator email.")
    password: str = Field(..., description="Administrator password.")


class Tokens(BaseModel):
    accessToken: str  # noqa: N815 - camelCase matches the frontend token contract
    refreshToken: str  # noqa: N815


class AdminInfo(BaseModel):
    email: str


class LoginData(BaseModel):
    tokens: Tokens
    user: AdminInfo


class LoginResponse(BaseModel):
    success: bool = True
    message: str = "Login successful"
    timestamp: datetime
    data: LoginData


class ChangePasswordRequest(BaseModel):
    email: str = Field(..., description="Administrator email whose password to change.")
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1)
    confirm_new_password: str = Field(..., min_length=1)


class SimpleResponse(BaseModel):
    success: bool
    message: str
