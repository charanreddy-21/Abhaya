from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.server.app.shared.models import WitnessAlert


class WitnessAlertRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, alert_id: str) -> WitnessAlert | None:
        result = await self._db.execute(
            select(WitnessAlert)
            .options(selectinload(WitnessAlert.incident), selectinload(WitnessAlert.witness))
            .where(WitnessAlert.id == alert_id)
        )
        return result.scalar_one_or_none()

    async def get_pending_for_witness(self, witness_id: str) -> list[WitnessAlert]:
        result = await self._db.execute(
            select(WitnessAlert)
            .options(selectinload(WitnessAlert.incident), selectinload(WitnessAlert.witness))
            .where(
                WitnessAlert.witness_id == witness_id,
                WitnessAlert.status.in_(["alerted", "acknowledged"]),
            )
            .order_by(WitnessAlert.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_for_incident(self, incident_id: str) -> list[WitnessAlert]:
        result = await self._db.execute(
            select(WitnessAlert)
            .options(selectinload(WitnessAlert.witness))
            .where(WitnessAlert.incident_id == incident_id)
        )
        return list(result.scalars().all())

    async def already_alerted(self, incident_id: str, witness_id: str) -> bool:
        result = await self._db.execute(
            select(WitnessAlert).where(
                WitnessAlert.incident_id == incident_id,
                WitnessAlert.witness_id == witness_id,
            )
        )
        return result.scalar_one_or_none() is not None

    async def create(self, incident_id: str, witness_id: str, distance_meters: float) -> WitnessAlert:
        alert = WitnessAlert(incident_id=incident_id, witness_id=witness_id, distance_meters=distance_meters)
        self._db.add(alert)
        await self._db.commit()
        await self._db.refresh(alert)
        return alert

    async def update_status(self, alert: WitnessAlert, status: str) -> WitnessAlert:
        from datetime import datetime, timezone
        alert.status = status
        if status == "acknowledged":
            alert.acknowledged_at = datetime.now(timezone.utc)
        elif status == "revealed":
            alert.revealed_at = datetime.now(timezone.utc)
        await self._db.commit()
        await self._db.refresh(alert)
        return alert
