"""
Safe Trip repository.

All database access for trip_monitors table lives here.
Services call this; route handlers do not.

The repository accepts a session_factory (not an open session) so it can
open a fresh connection per operation. This means the service can be wired
once at startup in app.state without holding a long-lived DB connection.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Callable, Any
import uuid


PING_GRACE_SECONDS = 120   # 2-minute grace window after ETA before escalation


class SafeTripRepository:
    """
    Persistence layer for trip_monitors.

    Pass session_factory=SessionLocal at construction time.
    Each async method opens its own session and commits/closes it.

    Replace the stub bodies with real SQLAlchemy async queries when
    the trip_monitors table is created in the migration.
    """

    def __init__(self, session_factory: Callable[[], Any]):
        self._session_factory = session_factory

    async def create(
        self,
        user_id: str,
        destination_label: str,
        expected_arrival_at: datetime,
        latitude: Optional[float],
        longitude: Optional[float],
    ) -> dict:
        """Insert a new trip row. Returns the new row as a dict."""
        trip_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        row = {
            "id": trip_id,
            "user_id": user_id,
            "destination_label": destination_label,
            "status": "active",
            "expected_arrival_at": expected_arrival_at,
            "latitude": latitude,
            "longitude": longitude,
            "ping_sent_at": None,
            "ping_deadline_at": None,
            "incident_id": None,
            "created_at": now,
            "resolved_at": None,
        }
        # TODO: persist to trip_monitors table
        # async with self._session_factory() as db:
        #     db.add(TripMonitor(**row))
        #     await db.commit()
        return row

    async def get_by_id(self, trip_id: str) -> Optional[dict]:
        """Return trip row or None."""
        # TODO: SELECT * FROM trip_monitors WHERE id = :trip_id
        # async with self._session_factory() as db:
        #     result = await db.execute(select(TripMonitor).where(TripMonitor.id == trip_id))
        #     row = result.scalar_one_or_none()
        #     return row.__dict__ if row else None
        raise NotImplementedError("trip_monitors table not yet migrated")

    async def get_active_for_user(self, user_id: str) -> Optional[dict]:
        """Return the single active/pending trip for a user, or None."""
        # TODO: SELECT * FROM trip_monitors
        #       WHERE user_id = :user_id
        #       AND status NOT IN ('resolved','cancelled','escalated')
        #       ORDER BY created_at DESC LIMIT 1
        return None  # safe stub: no active trip found

    async def list_for_user(self, user_id: str, limit: int = 20) -> list[dict]:
        """Return recent trips for a user, newest first."""
        # TODO: SELECT * FROM trip_monitors WHERE user_id = :user_id
        #       ORDER BY created_at DESC LIMIT :limit
        return []  # safe stub: empty list

    async def set_status(
        self,
        trip_id: str,
        status: str,
        *,
        ping_sent_at: Optional[datetime] = None,
        ping_deadline_at: Optional[datetime] = None,
        incident_id: Optional[str] = None,
        resolved_at: Optional[datetime] = None,
    ) -> dict:
        """Update status and optional fields. Returns updated row."""
        raise NotImplementedError("trip_monitors table not yet migrated")

    async def extend_arrival(self, trip_id: str, new_arrival_at: datetime) -> dict:
        """Reset expected_arrival_at and move status back to active."""
        raise NotImplementedError("trip_monitors table not yet migrated")

    async def get_trips_due_for_ping(self, cutoff: datetime) -> list[dict]:
        """
        Returns trips where:
          status = 'active' AND expected_arrival_at <= cutoff
        Called by the background scheduler every ~30 seconds.
        """
        # TODO: SELECT * FROM trip_monitors
        #       WHERE status = 'active' AND expected_arrival_at <= :cutoff
        return []

    async def get_trips_due_for_escalation(self, cutoff: datetime) -> list[dict]:
        """
        Returns trips where:
          status = 'pending_checkin' AND ping_deadline_at <= cutoff
        """
        # TODO: SELECT * FROM trip_monitors
        #       WHERE status = 'pending_checkin' AND ping_deadline_at <= :cutoff
        return []