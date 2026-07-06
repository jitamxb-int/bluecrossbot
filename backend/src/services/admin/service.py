"""Admin authentication service: login + change-password.

Credentials are verified against the salted password hash stored in MongoDB
(``AdminRepository``). Failures raise :class:`AuthError` carrying a user-facing
message and an HTTP status the route surfaces to the client.
"""

from __future__ import annotations

from src.core.logging.setup import get_logger
from src.storage.mongo.admin import AdminRepository, AdminUser
from src.utils.passwords import hash_password, verify_password

logger = get_logger(__name__)


class AuthError(Exception):
    """Raised on invalid credentials / failed password change."""

    def __init__(self, message: str, status_code: int = 401) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AdminAuthService:
    def __init__(self, admins: AdminRepository) -> None:
        self._admins = admins

    async def login(self, email: str, password: str) -> AdminUser:
        """Return the admin on valid credentials; raise AuthError otherwise."""
        admin = await self._admins.get_by_email(email)
        if admin is None or not verify_password(password, admin.password_hash):
            raise AuthError("Invalid email or password", 401)
        logger.info("admin_login_success", email=email)
        return admin

    async def change_password(
        self, email: str, current_password: str, new_password: str, confirm_new_password: str
    ) -> None:
        """Validate current password + confirmation, then replace the stored hash."""
        admin = await self._admins.get_by_email(email)
        if admin is None or not verify_password(current_password, admin.password_hash):
            raise AuthError("Current password is incorrect", 401)
        if new_password != confirm_new_password:
            raise AuthError("New password and confirmation do not match", 400)
        await self._admins.set_password(email, hash_password(new_password))
        logger.info("admin_password_changed", email=email)
