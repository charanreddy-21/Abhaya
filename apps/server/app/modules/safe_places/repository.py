from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.shared.models import SafePlace


class SafePlaceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_all(self, kind: str | None = None) -> list[SafePlace]:
        q = select(SafePlace)
        if kind:
            q = q.where(SafePlace.kind == kind)
        result = await self._db.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, place_id: str) -> SafePlace | None:
        result = await self._db.execute(select(SafePlace).where(SafePlace.id == place_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        name: str,
        kind: str,
        lat: float,
        lng: float,
        address: str,
        is_open: bool,
        added_by: str | None,
        verification_level: str = "community",
    ) -> SafePlace:
        place = SafePlace(
            name=name,
            kind=kind,
            lat=lat,
            lng=lng,
            address=address,
            is_open=is_open,
            added_by=added_by,
            verification_level=verification_level,
        )
        self._db.add(place)
        await self._db.commit()
        await self._db.refresh(place)
        return place

    async def count(self) -> int:
        result = await self._db.execute(select(SafePlace))
        return len(result.scalars().all())
