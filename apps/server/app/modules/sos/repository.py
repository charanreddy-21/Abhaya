from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.server.app.shared.models import Incident


class SOSRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, incident_id: str) -> Incident | None:
        result = await self._db.execute(
            select(Incident)
            .options(selectinload(Incident.witness_alerts), selectinload(Incident.evidence_items))
            .where(Incident.id == incident_id)
        )
        return result.scalar_one_or_none()

    async def get_active_for_user(self, user_id: str) -> list[Incident]:
        result = await self._db.execute(
            select(Incident)
            .options(selectinload(Incident.witness_alerts), selectinload(Incident.evidence_items))
            .where(Incident.user_id == user_id, Incident.status == "active")
            .order_by(Incident.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_for_user(self, user_id: str, limit: int = 20) -> list[Incident]:
        result = await self._db.execute(
            select(Incident)
            .options(selectinload(Incident.witness_alerts), selectinload(Incident.evidence_items))
            .where(Incident.user_id == user_id)
            .order_by(Incident.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_all(self, limit: int = 50, offset: int = 0, status: str | None = None) -> list[Incident]:
        q = select(Incident).options(
            selectinload(Incident.witness_alerts),
            selectinload(Incident.evidence_items),
            selectinload(Incident.user),
        )
        if status:
            q = q.where(Incident.status == status)
        q = q.order_by(Incident.created_at.desc()).limit(limit).offset(offset)
        result = await self._db.execute(q)
        return list(result.scalars().all())

    async def count_recent(self, user_id: str, window_seconds: int) -> int:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
        result = await self._db.execute(
            select(Incident).where(
                Incident.user_id == user_id,
                Incident.created_at >= cutoff,
            )
        )
        return len(result.scalars().all())

    async def create(self, user_id: str, lat: float, lng: float, accuracy_meters: float) -> Incident:
        incident = Incident(user_id=user_id, lat=lat, lng=lng, accuracy_meters=accuracy_meters)
        self._db.add(incident)
        await self._db.commit()
        return await self._reload(incident.id)

    async def resolve(self, incident: Incident) -> Incident:
        incident.status = "resolved"
        incident.resolved_at = datetime.now(timezone.utc)
        await self._db.commit()
        return await self._reload(incident.id)

    async def _reload(self, incident_id: str) -> Incident:
        result = await self._db.execute(
            select(Incident)
            .options(selectinload(Incident.witness_alerts), selectinload(Incident.evidence_items))
            .where(Incident.id == incident_id)
        )
        return result.scalar_one()

    async def get_all_active(self) -> list[Incident]:
        result = await self._db.execute(
            select(Incident).where(Incident.status == "active")
        )
        return list(result.scalars().all())
