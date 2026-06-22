import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.config import settings
from apps.server.app.modules.witness_alerts.repository import WitnessAlertRepository
from apps.server.app.modules.witness_alerts.schemas import WitnessAlertOut
from apps.server.app.shared.errors import forbidden, witness_alert_not_found, witness_not_opted_in
from apps.server.app.shared.models import AuditEvent, Incident, User, WitnessAlert
from apps.server.app.shared.utils import approx_lat_lng, haversine_meters


def _to_out(alert: WitnessAlert, requesting_witness_id: str) -> WitnessAlertOut:
    incident = alert.incident
    approx_lat, approx_lng = approx_lat_lng(incident.lat, incident.lng)
    approx_distance = int(round(alert.distance_meters / 50) * 50)  # round to nearest 50 m

    # Only expose display name if the witness chose to reveal themselves
    display_name = None
    if alert.status == "revealed" and alert.witness_id == requesting_witness_id:
        display_name = alert.witness.display_name if alert.witness else None

    return WitnessAlertOut(
        id=alert.id,
        incident_id=alert.incident_id,
        status=alert.status,
        approx_distance_meters=approx_distance,
        incident_approx_lat=approx_lat,
        incident_approx_lng=approx_lng,
        incident_created_at=incident.created_at,
        acknowledged_at=alert.acknowledged_at,
        revealed_at=alert.revealed_at,
        witness_display_name=display_name,
    )


class WitnessAlertService:
    def __init__(self, db: AsyncSession) -> None:
        self._repo = WitnessAlertRepository(db)
        self._db = db

    async def dispatch_alerts(self, incident: Incident) -> int:
        """Find opted-in witnesses within radius and create alert records."""
        result = await self._db.execute(
            select(User).where(User.witness_opt_in == True, User.id != incident.user_id)  # noqa: E712
        )
        candidates = result.scalars().all()

        alerted = 0
        for witness in candidates:
            # We need witness location — for prototype, witnesses don't have stored locations.
            # In production this would use PostGIS + Redis live presence.
            # For demo: alert all opted-in witnesses (no distance filter without live locations).
            already = await self._repo.already_alerted(incident.id, witness.id)
            if already:
                continue

            # Use a dummy distance since we have no live witness location in prototype
            dummy_distance = settings.witness_alert_radius_meters * 0.5
            await self._repo.create(incident.id, witness.id, dummy_distance)
            alerted += 1

        return alerted

    async def list_for_witness(self, witness_id: str) -> list[WitnessAlertOut]:
        alerts = await self._repo.get_pending_for_witness(witness_id)
        return [_to_out(a, witness_id) for a in alerts]

    async def acknowledge(self, alert_id: str, witness_id: str) -> WitnessAlertOut:
        alert = await self._repo.get_by_id(alert_id)
        if not alert:
            raise witness_alert_not_found()
        if alert.witness_id != witness_id:
            raise forbidden("this alert")
        if alert.witness and not alert.witness.witness_opt_in:
            raise witness_not_opted_in()
        if alert.status not in ("alerted",):
            pass  # idempotent — already acknowledged or revealed is fine
        updated = await self._repo.update_status(alert, "acknowledged")
        return _to_out(updated, witness_id)

    async def reveal(self, alert_id: str, witness_id: str) -> WitnessAlertOut:
        alert = await self._repo.get_by_id(alert_id)
        if not alert:
            raise witness_alert_not_found()
        if alert.witness_id != witness_id:
            raise forbidden("this alert")
        updated = await self._repo.update_status(alert, "revealed")

        # Audit identity disclosure — privacy-sensitive action
        audit = AuditEvent(
            actor_id=witness_id,
            action="witness.identity.revealed",
            resource_type="witness_alert",
            resource_id=alert_id,
            metadata_json=json.dumps({"incident_id": alert.incident_id}),
        )
        self._db.add(audit)
        await self._db.commit()

        return _to_out(updated, witness_id)
