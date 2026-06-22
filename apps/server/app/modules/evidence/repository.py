from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.shared.models import EvidenceItem


class EvidenceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, evidence_id: str) -> EvidenceItem | None:
        result = await self._db.execute(
            select(EvidenceItem).where(EvidenceItem.id == evidence_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: str) -> list[EvidenceItem]:
        result = await self._db.execute(
            select(EvidenceItem)
            .where(EvidenceItem.user_id == user_id)
            .order_by(EvidenceItem.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_for_incident(self, incident_id: str) -> list[EvidenceItem]:
        result = await self._db.execute(
            select(EvidenceItem)
            .where(EvidenceItem.incident_id == incident_id)
            .order_by(EvidenceItem.created_at.asc())
        )
        return list(result.scalars().all())

    async def count_for_incident(self, incident_id: str) -> int:
        result = await self._db.execute(
            select(EvidenceItem).where(EvidenceItem.incident_id == incident_id)
        )
        return len(result.scalars().all())

    async def create(
        self,
        incident_id: str,
        user_id: str,
        kind: str,
        label: str,
        filename: str,
        size_bytes: int,
        sha256_hash: str,
    ) -> EvidenceItem:
        item = EvidenceItem(
            incident_id=incident_id,
            user_id=user_id,
            kind=kind,
            label=label,
            filename=filename,
            size_bytes=size_bytes,
            sha256_hash=sha256_hash,
            upload_status="uploaded",
        )
        self._db.add(item)
        await self._db.commit()
        await self._db.refresh(item)
        return item

    async def anchor(self, item: EvidenceItem) -> EvidenceItem:
        item.anchored = True
        await self._db.commit()
        await self._db.refresh(item)
        return item

    async def delete(self, item: EvidenceItem) -> None:
        await self._db.delete(item)
        await self._db.commit()

    async def list_all(self, limit: int = 100) -> list[EvidenceItem]:
        result = await self._db.execute(
            select(EvidenceItem).order_by(EvidenceItem.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())
