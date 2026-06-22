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


def _date_filter(start: datetime | None, end: datetime | None) -> dict:
    """Build a Mongo filter on ``created_at`` for an optional date range.

    Returns ``{}`` (match-all) when neither bound is given, so the count
    methods behave exactly as before for all-time queries.
    """
    rng: dict = {}
    if start is not None:
        rng["$gte"] = _as_aware(start)
    if end is not None:
        rng["$lte"] = _as_aware(end)
    return {"created_at": rng} if rng else {}


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
        name = "blue_cross_chat_session"
        indexes = [IndexModel([("session_id", 1)], unique=True, name="uniq_session_id")]


class SessionRepository:
    """All reads/writes of session memory go through this small repository."""

    async def count_sessions(
        self, start_date: datetime | None = None, end_date: datetime | None = None
    ) -> int:
        """Return the number of persisted chat sessions in the optional date range."""
        return await ChatSession.find(_date_filter(start_date, end_date)).count()

    async def count_sessions_messages(
        self, start_date: datetime | None = None, end_date: datetime | None = None
    ) -> int:
        """Return the total message count across sessions in the optional date range."""
        sessions = await ChatSession.find(_date_filter(start_date, end_date)).to_list()
        total_messages = 0
        for session in sessions:
            message_count = len(session.chat_json)
            total_messages += message_count
        return total_messages

    async def count_sessions_minutes(
        self, start_date: datetime | None = None, end_date: datetime | None = None
    ) -> float:
        """Return the total persisted chat duration (minutes) in the optional date range."""
        sessions = await ChatSession.find(_date_filter(start_date, end_date)).to_list()
        total_seconds = sum(session.duration_seconds or 0.0 for session in sessions)
        return total_seconds / 60

    _SORT_FIELD_MAP: dict[str, str] = {
        "id": "_id",
        "started_at": "started_at",
        "ended_at": "ended_at",
        "duration_seconds": "duration_seconds",
        "created_at": "created_at",
    }

    async def list_sessions(
        self,
        limit: int,
        offset: int,
        status: str | None,
        sort_by: str,
        sort_order: str,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> tuple[int, list["ChatSession"]]:
        """Return ``(total, page)`` with optional status/date filters and sorting."""
        filter_expr = {}
        if status == "active":
            filter_expr = {"is_active": True}
        elif status == "inactive":
            filter_expr = {"is_active": False}
        filter_expr.update(_date_filter(start_date, end_date))

        query = ChatSession.find(filter_expr) if filter_expr else ChatSession.find_all()
        total = await query.count()

        mongo_field = self._SORT_FIELD_MAP.get(sort_by, "_id")
        sort_expr = f"+{mongo_field}" if sort_order == "asc" else f"-{mongo_field}"
        sessions = (
            await query.sort(sort_expr)
            .skip(offset)
            .limit(limit)
            .to_list()
        )
        return total, sessions

    async def list_chat_json_by_session_id(self) -> dict[str, list[dict]]:
        """Return all persisted transcripts keyed by session id."""
        sessions = await ChatSession.find_all().to_list()
        return {session.session_id: session.chat_json for session in sessions}

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
