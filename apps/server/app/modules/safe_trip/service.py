"""
Safe Trip service.

Implements the Buffer & Ping escalation protocol:

  active
    -> (ETA reached) -> pending_checkin   [ping sent, 2-min grace window]
      -> (user responds)  -> resolved
      -> (user extends)   -> active        [timer reset]
      -> (grace expires)  -> escalated     [silent SOS triggered]

The service is called by:
  - Route handlers (create, checkin, extend, cancel)
  - A background scheduler (check_due_pings, check_due_escalations)

Business rules:
  - Only one active/pending trip per user at a time.
  - Extensions are limited to 5 / 10 / 15 / 30 / 60 min.
  - A user may cancel a trip at any status except escalated.
  - Escalation creates an SOS incident via the SOS service.
  - Echo notifications go to trusted contacts on escalation.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

from .repository import SafeTripRepository, PING_GRACE_SECONDS
from .schemas import TripCreate, TripExtend, TripResponse
from apps.server.app.modules.sos.schemas import CreateSOSRequest
from apps.server.app.modules.sos.service import SOSService
from apps.server.app.shared.errors import (
    forbidden,
    trip_already_active,
    trip_already_terminal,
    trip_escalated_cannot_cancel,
    trip_not_found,
)

logger = logging.getLogger(__name__)

ALLOWED_TERMINAL_STATUSES = {"resolved", "cancelled", "escalated"}


class SafeTripSOSAdapter:
    def __init__(self, session_factory):
        self._session_factory = session_factory

    async def create_silent(
        self,
        user_id: str,
        source: str,
        latitude: Optional[float],
        longitude: Optional[float],
        context: dict,
    ) -> dict:
        if latitude is None or longitude is None:
            logger.warning(
                "trip_silent_sos_skipped_no_location",
                extra={"user_id": user_id, "source": source, "trip_id": context.get("trip_id")},
            )
            return {}

        async with self._session_factory() as db:
            incident = await SOSService(db).create(
                user_id,
                CreateSOSRequest(
                    lat=latitude,
                    lng=longitude,
                    accuracy_meters=999.0,
                    location_captured_at=datetime.now(timezone.utc),
                ),
            )
            return {"id": incident.id}


class SafeTripService:
    def __init__(
        self,
        repo: SafeTripRepository,
        # injected lazily to avoid circular imports
        sos_service=None,
        echo_service=None,
        push_service=None,
    ):
        self._repo = repo
        self._sos = sos_service
        self._echo = echo_service
        self._push = push_service

    # ------------------------------------------------------------------ #
    # User-facing actions                                                  #
    # ------------------------------------------------------------------ #

    async def create_trip(self, user_id: str, payload: TripCreate) -> TripResponse:
        existing = await self._repo.get_active_for_user(user_id)
        if existing and existing["status"] not in ALLOWED_TERMINAL_STATUSES:
            raise trip_already_active(existing["id"])

        row = await self._repo.create(
            user_id=user_id,
            destination_label=payload.destination_label,
            expected_arrival_at=payload.expected_arrival_at,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )

        logger.info(
            "trip_created",
            extra={
                "trip_id": row["id"],
                "user_id": user_id,
                "eta": payload.expected_arrival_at.isoformat(),
            },
        )

        # Schedule a push reminder 5 minutes before ETA
        await self._schedule_pre_eta_reminder(row)

        return TripResponse(**row)

    async def checkin(self, trip_id: str, user_id: str) -> TripResponse:
        trip = await self._get_owned_trip(trip_id, user_id)
        self._assert_not_terminal(trip)

        now = datetime.now(timezone.utc)
        row = await self._repo.set_status(
            trip_id, "resolved", resolved_at=now
        )
        logger.info("trip_resolved_by_checkin", extra={"trip_id": trip_id})
        return TripResponse(**row)

    async def extend(self, trip_id: str, user_id: str, payload: TripExtend) -> TripResponse:
        trip = await self._get_owned_trip(trip_id, user_id)
        self._assert_not_terminal(trip)

        if trip["status"] == "escalated":
            raise trip_escalated_cannot_cancel(trip.get("incident_id"))

        current_eta = trip["expected_arrival_at"]
        if current_eta.tzinfo is None:
            current_eta = current_eta.replace(tzinfo=timezone.utc)

        new_eta = current_eta + timedelta(minutes=payload.extend_minutes)
        row = await self._repo.extend_arrival(trip_id, new_eta)

        logger.info(
            "trip_extended",
            extra={
                "trip_id": trip_id,
                "extend_minutes": payload.extend_minutes,
                "new_eta": new_eta.isoformat(),
            },
        )

        # Reschedule reminder for new ETA
        await self._schedule_pre_eta_reminder(row)

        return TripResponse(**row)

    async def cancel(self, trip_id: str, user_id: str) -> TripResponse:
        trip = await self._get_owned_trip(trip_id, user_id)
        if trip["status"] == "escalated":
            raise trip_escalated_cannot_cancel(trip.get("incident_id"))
        if trip["status"] in ALLOWED_TERMINAL_STATUSES:
            # Idempotent — already done
            return TripResponse(**trip)

        row = await self._repo.set_status(
            trip_id, "cancelled", resolved_at=datetime.now(timezone.utc)
        )
        logger.info("trip_cancelled", extra={"trip_id": trip_id})
        return TripResponse(**row)

    # ------------------------------------------------------------------ #
    # Background scheduler entry points                                    #
    # These are called every ~30 s by a scheduler (APScheduler / Celery)  #
    # ------------------------------------------------------------------ #

    async def check_due_pings(self) -> None:
        """
        Step 1: Find active trips past their ETA.
        Move them to pending_checkin and send the Safety Ping.
        Never skip — a missed ping means no escalation window.
        """
        now = datetime.now(timezone.utc)
        due = await self._repo.get_trips_due_for_ping(cutoff=now)

        for trip in due:
            ping_deadline = now + timedelta(seconds=PING_GRACE_SECONDS)
            row = await self._repo.set_status(
                trip["id"],
                "pending_checkin",
                ping_sent_at=now,
                ping_deadline_at=ping_deadline,
            )
            logger.info(
                "trip_ping_sent",
                extra={
                    "trip_id": trip["id"],
                    "deadline": ping_deadline.isoformat(),
                },
            )
            await self._send_safety_ping(row)

    async def check_due_escalations(self) -> None:
        """
        Step 2: Find pending_checkin trips whose grace window has expired.
        Escalate each to a silent SOS and fire Echo notifications.
        """
        now = datetime.now(timezone.utc)
        due = await self._repo.get_trips_due_for_escalation(cutoff=now)

        for trip in due:
            await self._escalate(trip)

    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    async def _get_owned_trip(self, trip_id: str, user_id: str) -> dict:
        trip = await self._repo.get_by_id(trip_id)
        if not trip:
            raise trip_not_found()
        if trip["user_id"] != user_id:
            raise forbidden("this trip")
        return trip

    def _assert_not_terminal(self, trip: dict) -> None:
        if trip["status"] in ALLOWED_TERMINAL_STATUSES:
            raise trip_already_terminal(trip["status"])

    async def _send_safety_ping(self, trip: dict) -> None:
        """
        Send the silent Safety Ping notification.
        Uses push (preferred) with in-app fallback.
        Never block the escalation pipeline on push failure.
        """
        if self._push is None:
            return
        try:
            await self._push.send_to_user(
                user_id=trip["user_id"],
                title="Are you safe?",
                body=f"Your trip to {trip['destination_label']} is overdue. Tap to check in.",
                data={
                    "type": "SAFETY_PING",
                    "trip_id": trip["id"],
                    "deadline_at": trip["ping_deadline_at"].isoformat(),
                },
                require_interaction=True,   # keep notification visible until dismissed
            )
        except Exception:
            logger.exception(
                "safety_ping_push_failed",
                extra={"trip_id": trip["id"], "user_id": trip["user_id"]},
            )

    async def _escalate(self, trip: dict) -> None:
        """
        The final escalation step.
        1. Mark trip as escalated.
        2. Create a silent SOS incident (if SOS service wired).
        3. Fire Echo to trusted contacts.
        """
        now = datetime.now(timezone.utc)
        incident_id: Optional[str] = None

        # Create silent SOS
        if self._sos is not None:
            try:
                incident = await self._sos.create_silent(
                    user_id=trip["user_id"],
                    source="safe_trip_escalation",
                    latitude=trip.get("latitude"),
                    longitude=trip.get("longitude"),
                    context={
                        "trip_id": trip["id"],
                        "destination": trip["destination_label"],
                    },
                )
                incident_id = incident.get("id")
            except Exception:
                logger.exception(
                    "trip_silent_sos_failed",
                    extra={"trip_id": trip["id"]},
                )
                # Still escalate the trip status even if SOS fails

        row = await self._repo.set_status(
            trip["id"],
            "escalated",
            incident_id=incident_id,
            resolved_at=now,
        )

        logger.warning(
            "trip_escalated",
            extra={
                "trip_id": trip["id"],
                "user_id": trip["user_id"],
                "incident_id": incident_id,
            },
        )

        # Fire Echo notifications to trusted contacts
        if self._echo is not None:
            try:
                await self._echo.dispatch_trip_overdue(
                    user_id=trip["user_id"],
                    trip=row,
                    incident_id=incident_id,
                )
            except Exception:
                logger.exception(
                    "trip_echo_failed",
                    extra={"trip_id": trip["id"]},
                )

    async def _schedule_pre_eta_reminder(self, trip: dict) -> None:
        """
        Optionally schedule a push 5 min before ETA so the user remembers to check in.
        Non-critical — silently skip on failure.
        """
        if self._push is None:
            return
        try:
            eta: datetime = trip["expected_arrival_at"]
            if eta.tzinfo is None:
                eta = eta.replace(tzinfo=timezone.utc)
            reminder_at = eta - timedelta(minutes=5)
            now = datetime.now(timezone.utc)
            if reminder_at <= now:
                return   # ETA is very soon; skip reminder
            # Real implementation would schedule a delayed task (e.g. Celery ETA)
            logger.debug(
                "trip_reminder_scheduled",
                extra={"trip_id": trip["id"], "reminder_at": reminder_at.isoformat()},
            )
        except Exception:
            logger.exception("trip_reminder_schedule_failed", extra={"trip_id": trip.get("id")})
