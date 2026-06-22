import json
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.server.app.modules.admin.schemas import (
    AdminAuditEventOut,
    AdminEvidenceOut,
    AdminIncidentDetailOut,
    AdminIncidentOut,
    AdminUserListPage,
    AdminUserOut,
    AdminWitnessOut,
    AuditLogPage,
    SystemMetricsOut,
)
from apps.server.app.modules.auth.repository import UserRepository
from apps.server.app.modules.sos.repository import SOSRepository
from apps.server.app.shared.errors import sos_not_found
from apps.server.app.shared.models import (
    AuditEvent,
    EvidenceItem,
    Incident,
    SafePlace,
    User,
    WitnessAlert,
)
from apps.server.app.shared.utils import approx_lat_lng

_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _incident_to_out(incident: Incident) -> AdminIncidentOut:
    now = datetime.now(timezone.utc)
    created = incident.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    elapsed = int((now - created).total_seconds())
    approx_lat, approx_lng = approx_lat_lng(incident.lat, incident.lng)
    alerts = incident.witness_alerts or []
    acks = [a for a in alerts if a.status in ("acknowledged", "revealed")]
    return AdminIncidentOut(
        id=incident.id,
        display_id=f"#{incident.id[:6].upper()}",
        status=incident.status,
        user_display_name=incident.user.display_name if incident.user else "Unknown",
        approx_lat=approx_lat,
        approx_lng=approx_lng,
        accuracy_meters=incident.accuracy_meters,
        witness_alert_count=len(alerts),
        witness_ack_count=len(acks),
        evidence_count=len(incident.evidence_items or []),
        elapsed_seconds=max(0, elapsed),
        created_at=incident.created_at,
        resolved_at=incident.resolved_at,
    )


def _witness_to_out(alert: WitnessAlert, label: str) -> AdminWitnessOut:
    revealed = alert.status == "revealed"
    return AdminWitnessOut(
        id=alert.id,
        label=f"Witness {label}",
        status=alert.status,
        approx_distance_meters=int(round(alert.distance_meters / 50) * 50),
        revealed=revealed,
        display_name=alert.witness.display_name if (revealed and alert.witness) else None,
    )


def _evidence_to_out(item: EvidenceItem) -> AdminEvidenceOut:
    return AdminEvidenceOut(
        id=item.id,
        kind=item.kind,
        label=item.label,
        size_bytes=item.size_bytes,
        sha256_hash=item.sha256_hash,
        anchored=item.anchored,
        upload_status=item.upload_status,
    )


def _audit_to_out(event: AuditEvent) -> AdminAuditEventOut:
    meta = json.loads(event.metadata_json or "{}")
    actor_label = meta.get("actor_email") or (f"User:{event.actor_id[:8]}" if event.actor_id else "System")
    return AdminAuditEventOut(
        id=event.id,
        action=event.action,
        resource_type=event.resource_type,
        resource_id=event.resource_id,
        actor_label=actor_label,
        ip_address=event.ip_address,
        created_at=event.created_at,
    )


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._sos_repo = SOSRepository(db)

    async def list_incidents(
        self,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AdminIncidentOut]:
        incidents = await self._sos_repo.list_all(limit=limit, offset=offset, status=status)
        return [_incident_to_out(i) for i in incidents]

    async def get_incident_detail(self, incident_id: str, admin_id: str, admin_email: str) -> AdminIncidentDetailOut:
        result = await self._db.execute(
            select(Incident)
            .options(
                selectinload(Incident.witness_alerts).selectinload(WitnessAlert.witness),
                selectinload(Incident.evidence_items),
                selectinload(Incident.user),
            )
            .where(Incident.id == incident_id)
        )
        incident = result.scalar_one_or_none()
        if not incident:
            raise sos_not_found()

        # Audit-log this access
        await self._log_admin_access(admin_id, admin_email, incident_id)

        alerts = incident.witness_alerts or []
        witnesses = [_witness_to_out(a, _LABELS[i % 26]) for i, a in enumerate(alerts)]
        evidence = [_evidence_to_out(e) for e in (incident.evidence_items or [])]

        # Fetch audit trail for this incident
        audit_result = await self._db.execute(
            select(AuditEvent)
            .where(AuditEvent.resource_id == incident_id)
            .order_by(AuditEvent.created_at.asc())
            .limit(50)
        )
        timeline = [_audit_to_out(e) for e in audit_result.scalars().all()]

        return AdminIncidentDetailOut(
            incident=_incident_to_out(incident),
            witnesses=witnesses,
            evidence=evidence,
            timeline=timeline,
        )

    async def resolve_incident(self, incident_id: str, admin_id: str) -> AdminIncidentOut:
        incident = await self._sos_repo.get_by_id(incident_id)
        if not incident:
            raise sos_not_found()
        from apps.server.app.shared.errors import sos_already_resolved
        if incident.status == "resolved":
            raise sos_already_resolved()
        incident = await self._sos_repo.resolve(incident)

        # Audit log
        event = AuditEvent(
            actor_id=admin_id,
            action="admin.incident.resolve",
            resource_type="incident",
            resource_id=incident_id,
            metadata_json=json.dumps({"resolved_by_admin": True}),
        )
        self._db.add(event)
        await self._db.commit()

        return _incident_to_out(incident)

    async def get_metrics(self) -> SystemMetricsOut:
        active_result = await self._db.execute(
            select(func.count()).select_from(Incident).where(Incident.status == "active")
        )
        total_result = await self._db.execute(select(func.count()).select_from(Incident))
        users_result = await self._db.execute(select(func.count()).select_from(User))
        evidence_result = await self._db.execute(select(func.count()).select_from(EvidenceItem))
        places_result = await self._db.execute(select(func.count()).select_from(SafePlace))

        return SystemMetricsOut(
            active_incidents=active_result.scalar() or 0,
            total_incidents=total_result.scalar() or 0,
            total_users=users_result.scalar() or 0,
            total_evidence=evidence_result.scalar() or 0,
            total_safe_places=places_result.scalar() or 0,
            db_status="ok",
        )

    async def list_audit_log(
        self,
        action_prefix: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> AuditLogPage:
        query = select(AuditEvent).order_by(AuditEvent.created_at.desc())
        count_query = select(func.count()).select_from(AuditEvent)
        if action_prefix:
            query = query.where(AuditEvent.action.startswith(action_prefix))
            count_query = count_query.where(AuditEvent.action.startswith(action_prefix))

        total_result = await self._db.execute(count_query)
        total = total_result.scalar() or 0

        events_result = await self._db.execute(query.limit(limit).offset(offset))
        events = [_audit_to_out(e) for e in events_result.scalars().all()]

        return AuditLogPage(events=events, total=total, offset=offset, limit=limit)

    async def list_users(
        self,
        role: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> AdminUserListPage:
        query = select(User).options(selectinload(User.incidents))
        count_query = select(func.count()).select_from(User)
        if role:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)

        query = query.order_by(User.created_at.desc()).limit(limit).offset(offset)

        total_result = await self._db.execute(count_query)
        total = total_result.scalar() or 0

        users_result = await self._db.execute(query)
        users = users_result.scalars().all()

        user_outs = [
            AdminUserOut(
                id=u.id,
                display_name=u.display_name,
                role=u.role,
                witness_opt_in=u.witness_opt_in,
                anonymous_by_default=u.anonymous_by_default,
                has_push=bool(u.push_endpoint),
                incident_count=len(u.incidents) if u.incidents else 0,
                created_at=u.created_at,
            )
            for u in users
        ]

        return AdminUserListPage(users=user_outs, total=total, offset=offset, limit=limit)

    async def _log_admin_access(self, admin_id: str, admin_email: str, incident_id: str) -> None:
        event = AuditEvent(
            actor_id=admin_id,
            action="admin.incident.view",
            resource_type="incident",
            resource_id=incident_id,
            metadata_json=json.dumps({"actor_email": admin_email}),
        )
        self._db.add(event)
        await self._db.commit()
