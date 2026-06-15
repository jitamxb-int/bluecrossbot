"""MongoDB-backed chat session storage (Beanie).

Implements the design in ``docs/CONVERSATION_HISTORY.md``: one document per
``session_id`` holding the flat transcript (``chat_json``), a rolling
``conversation_summary``, and session timing (``started_at`` / ``ended_at`` /
``duration_seconds``). Each turn is a read-modify-write: LOAD the history, the
chat service RUNs the LLM, then ``append_turn`` SAVEs the new turn + summary and
recomputes timing.
"""

from __future__ import annotations

from datetime import UTC, datetime

from beanie import Document
from pydantic import Field
from pymongo import IndexModel

from src.core.logging.setup import get_logger

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _as_aware(dt: datetime) -> datetime:
    """Treat a naive datetime as UTC.

    Datetimes loaded back from MongoDB can be timezone-naive (BSON stores them
    without an offset), which can't be subtracted from a tz-aware ``now``.
    """
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


class ChatSession(Document):
    """One conversation thread. Identified by a unique ``session_id``."""

    session_id: str

    # --- conversation memory ---
    chat_json: list[dict] = Field(default_factory=list)  # flat transcript, 2 entries / turn
    conversation_summary: str | None = None  # rolling ~100-200 char summary

    # --- session timing ---
    started_at: datetime = Field(default_factory=_utcnow)
    ended_at: datetime | None = None
    duration_seconds: float = 0.0
    is_active: bool = True

    # --- bookkeeping ---
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "chat_session"
        indexes = [IndexModel([("session_id", 1)], unique=True, name="uniq_session_id")]


class SessionRepository:
    """All reads/writes of session memory go through this small repository."""

    async def get_history(self, session_id: str) -> tuple[bool, list[dict], str | None]:
        """Load ``(found, chat_json, conversation_summary)``; ``(False, [], None)`` if unknown.

        ``found`` is the authoritative existence signal for the session — a session
        always has >=1 turn once created, so this single ``find_one`` distinguishes a
        real session from an unrecognised id without any extra round-trip.
        """
        session = await ChatSession.find_one(ChatSession.session_id == session_id)
        if session:
            return True, session.chat_json, session.conversation_summary
        return False, [], None

    async def append_turn(
        self,
        session_id: str,
        user_query: str,
        assistant_content: str,
        summary: str | None = None,
    ) -> ChatSession:
        """Append one user+assistant turn, refresh the summary, update timing."""
        now = _utcnow()
        turn = [
            {"role": "user", "content": user_query},
            {"role": "assistant", "content": assistant_content},
        ]

        session = await ChatSession.find_one(ChatSession.session_id == session_id)
        if session is None:
            session = ChatSession(
                session_id=session_id,
                chat_json=turn,
                conversation_summary=summary,
                started_at=now,
                ended_at=now,
                duration_seconds=0.0,
            )
            await session.insert()
            return session

        session.chat_json.extend(turn)
        if summary is not None:
            session.conversation_summary = summary
        session.ended_at = now
        session.duration_seconds = (now - _as_aware(session.started_at)).total_seconds()
        session.updated_at = now
        await session.save()
        return session

    async def end_session(self, session_id: str) -> ChatSession | None:
        """Freeze timing and mark the session inactive (explicit close)."""
        now = _utcnow()
        session = await ChatSession.find_one(ChatSession.session_id == session_id)
        if session is None:
            return None
        session.ended_at = now
        session.duration_seconds = (now - _as_aware(session.started_at)).total_seconds()
        session.is_active = False
        session.updated_at = now
        await session.save()
        return session
