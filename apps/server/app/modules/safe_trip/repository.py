"""
Safe Trip repository.

All database access for trip_monitors table lives here.
Services call this; route handlers do not.

The repository accepts a session_factory (not an open session) so it can
open a fresh connection per operation. This means the service can be wired
once at startup in app.state without holding a long-lived DB connection.
"""

from datetime import datetime
from typing import Optional, Callable, Any

from sqlalchemy import select

from apps.server.app.shared.models import TripMonitor


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
        async with self._session_factory() as db:
            row = TripMonitor(
                user_id=user_id,
                destination_label=destination_label,
                expected_arrival_at=expected_arrival_at,
                latitude=latitude,
                longitude=longitude,
            )
            db.add(row)
            await db.commit()
            await db.refresh(row)
            return _to_dict(row)

    async def get_by_id(self, trip_id: str) -> Optional[dict]:
        """Return trip row or None."""
        async with self._session_factory() as db:
            result = await db.execute(select(TripMonitor).where(TripMonitor.id == trip_id))
            row = result.scalar_one_or_none()
            return _to_dict(row) if row else None

    async def get_active_for_user(self, user_id: str) -> Optional[dict]:
        """Return the single active/pending trip for a user, or None."""
        async with self._session_factory() as db:
            result = await db.execute(
                select(TripMonitor)
                .where(
                    TripMonitor.user_id == user_id,
                    TripMonitor.status.not_in(("resolved", "cancelled", "escalated")),
                )
                .order_by(TripMonitor.created_at.desc())
                .limit(1)
            )
            row = result.scalar_one_or_none()
            return _to_dict(row) if row else None

    async def list_for_user(self, user_id: str, limit: int = 20) -> list[dict]:
        """Return recent trips for a user, newest first."""
        async with self._session_factory() as db:
            result = await db.execute(
                select(TripMonitor)
                .where(TripMonitor.user_id == user_id)
                .order_by(TripMonitor.created_at.desc())
                .limit(limit)
            )
            return [_to_dict(row) for row in result.scalars().all()]

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
        async with self._session_factory() as db:
            result = await db.execute(select(TripMonitor).where(TripMonitor.id == trip_id))
            row = result.scalar_one()
            row.status = status
            if ping_sent_at is not None:
                row.ping_sent_at = ping_sent_at
            if ping_deadline_at is not None:
                row.ping_deadline_at = ping_deadline_at
            if incident_id is not None:
                row.incident_id = incident_id
            if resolved_at is not None:
                row.resolved_at = resolved_at
            await db.commit()
            await db.refresh(row)
            return _to_dict(row)

    async def extend_arrival(self, trip_id: str, new_arrival_at: datetime) -> dict:
        """Reset expected_arrival_at and move status back to active."""
        async with self._session_factory() as db:
            result = await db.execute(select(TripMonitor).where(TripMonitor.id == trip_id))
            row = result.scalar_one()
            row.expected_arrival_at = new_arrival_at
            row.status = "active"
            row.ping_sent_at = None
            row.ping_deadline_at = None
            await db.commit()
            await db.refresh(row)
            return _to_dict(row)

    async def get_trips_due_for_ping(self, cutoff: datetime) -> list[dict]:
        """
        Returns trips where:
          status = 'active' AND expected_arrival_at <= cutoff
        Called by the background scheduler every ~30 seconds.
        """
        async with self._session_factory() as db:
            result = await db.execute(
                select(TripMonitor).where(
                    TripMonitor.status == "active",
                    TripMonitor.expected_arrival_at <= cutoff,
                )
            )
            return [_to_dict(row) for row in result.scalars().all()]

    async def get_trips_due_for_escalation(self, cutoff: datetime) -> list[dict]:
        """
        Returns trips where:
          status = 'pending_checkin' AND ping_deadline_at <= cutoff
        """
        async with self._session_factory() as db:
            result = await db.execute(
                select(TripMonitor).where(
                    TripMonitor.status == "pending_checkin",
                    TripMonitor.ping_deadline_at <= cutoff,
                )
            )
            return [_to_dict(row) for row in result.scalars().all()]


def _to_dict(row: TripMonitor) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "destination_label": row.destination_label,
        "status": row.status,
        "expected_arrival_at": row.expected_arrival_at,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "ping_sent_at": row.ping_sent_at,
        "ping_deadline_at": row.ping_deadline_at,
        "incident_id": row.incident_id,
        "created_at": row.created_at,
        "resolved_at": row.resolved_at,
    }
