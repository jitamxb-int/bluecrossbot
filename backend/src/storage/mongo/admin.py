"""MongoDB-backed administrator credential storage (Beanie).

One document per admin (unique ``email``) holding a securely **hashed** password
(never plaintext). A default admin is seeded on startup if it doesn't exist.
"""

from __future__ import annotations

from datetime import UTC, datetime

from beanie import Document
from pydantic import Field
from pymongo import IndexModel

from src.core.logging.setup import get_logger
from src.utils.passwords import hash_password

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AdminUser(Document):
    """A single administrator account. Password is stored as a salted hash."""

    email: str
    password_hash: str
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "blue_cross_admin_users"
        indexes = [IndexModel([("email", 1)], unique=True, name="uniq_admin_email")]


class AdminRepository:
    """All reads/writes of admin credentials go through this small repository."""

    async def get_by_email(self, email: str) -> AdminUser | None:
        return await AdminUser.find_one(AdminUser.email == email)

    async def set_password(self, email: str, new_hash: str) -> AdminUser | None:
        """Replace the stored password hash for an admin. Returns the admin or None."""
        admin = await AdminUser.find_one(AdminUser.email == email)
        if admin is None:
            return None
        admin.password_hash = new_hash
        admin.updated_at = _utcnow()
        await admin.save()
        return admin

    async def ensure_default_admin(self, email: str, password: str) -> None:
        """Create the default admin (with a hashed password) if it doesn't exist."""
        existing = await AdminUser.find_one(AdminUser.email == email)
        if existing is not None:
            return
        await AdminUser(email=email, password_hash=hash_password(password)).insert()
        logger.info("default_admin_created", email=email)
