import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.config import settings
from apps.server.app.modules.sos.repository import SOSRepository
from apps.server.app.modules.sos.schemas import CreateSOSRequest, IncidentOut
from apps.server.app.modules.witness_alerts.service import WitnessAlertService
from apps.server.app.shared.errors import (
    forbidden,
    sos_already_resolved,
    sos_location_poor_accuracy,
    sos_location_stale,
    sos_not_found,
    sos_rate_limit,
)
from apps.server.app.shared.models import AuditEvent, Incident
from apps.server.app.shared.utils import approx_lat_lng


def _to_out(incident: Incident) -> IncidentOut:
    now = datetime.now(timezone.utc)
    approx_lat, approx_lng = approx_lat_lng(incident.lat, incident.lng)
    elapsed = int((now - incident.created_at.replace(tzinfo=timezone.utc) if incident.created_at.tzinfo is None else now - incident.created_at).total_seconds())
    return IncidentOut(
        id=incident.id,
        status=incident.status,
        approx_lat=approx_lat,
        approx_lng=approx_lng,
        accuracy_meters=incident.accuracy_meters,
        witness_alert_count=len(incident.witness_alerts) if incident.witness_alerts else 0,
        evidence_count=len(incident.evidence_items) if incident.evidence_items else 0,
        elapsed_seconds=max(0, elapsed),
        created_at=incident.created_at,
        resolved_at=incident.resolved_at,
    )


class SOSService:
    def __init__(self, db: AsyncSession) -> None:
        self._repo = SOSRepository(db)
        self._db = db

    async def create(self, user_id: str, req: CreateSOSRequest) -> IncidentOut:
        active = await self._repo.get_active_for_user(user_id)
        if active:
            return _to_out(active[0])

        if req.location_captured_at:
            captured_at = req.location_captured_at
            if captured_at.tzinfo is None:
                captured_at = captured_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - captured_at > timedelta(minutes=settings.max_sos_location_age_minutes):
                raise sos_location_stale()

        if req.accuracy_meters > settings.max_sos_accuracy_meters:
            raise sos_location_poor_accuracy()

        recent_count = await self._repo.count_recent(user_id, window_seconds=3600)
        if recent_count >= settings.max_sos_per_hour:
            raise sos_rate_limit()

        incident = await self._repo.create(user_id, req.lat, req.lng, req.accuracy_meters)

        # Fire-and-forget witness alerts asynchronously
        try:
            alert_svc = WitnessAlertService(self._db)
            await alert_svc.dispatch_alerts(incident)
        except Exception:
            pass  # Evidence/alerts are supplementary — never block SOS

        audit = AuditEvent(
            actor_id=user_id,
            action="sos.create",
            resource_type="incident",
            resource_id=incident.id,
            metadata_json=json.dumps({"accuracy_meters": req.accuracy_meters}),
        )
        self._db.add(audit)
        await self._db.commit()

        return _to_out(incident)

    async def get(self, incident_id: str, user_id: str) -> IncidentOut:
        incident = await self._repo.get_by_id(incident_id)
        if not incident:
            raise sos_not_found()
        if incident.user_id != user_id:
            raise forbidden("this incident")
        return _to_out(incident)

    async def resolve(self, incident_id: str, user_id: str) -> IncidentOut:
        incident = await self._repo.get_by_id(incident_id)
        if not incident:
            raise sos_not_found()
        if incident.user_id != user_id:
            raise forbidden("this incident")
        if incident.status == "resolved":
            raise sos_already_resolved()
        incident = await self._repo.resolve(incident)

        audit = AuditEvent(
            actor_id=user_id,
            action="sos.resolve",
            resource_type="incident",
            resource_id=incident_id,
            metadata_json=json.dumps({"resolved_by": "user"}),
        )
        self._db.add(audit)
        await self._db.commit()

        return _to_out(incident)

    async def list_active(self, user_id: str) -> list[IncidentOut]:
        incidents = await self._repo.get_active_for_user(user_id)
        return [_to_out(i) for i in incidents]

    async def list_all(self, user_id: str) -> list[IncidentOut]:
        incidents = await self._repo.list_for_user(user_id)
        return [_to_out(i) for i in incidents]
