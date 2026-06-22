from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.modules.safe_places.repository import SafePlaceRepository
from apps.server.app.modules.safe_places.schemas import CreateSafePlaceRequest, SafePlaceOut
from apps.server.app.shared.errors import forbidden, safe_place_not_found
from apps.server.app.shared.utils import haversine_meters


def _to_out(place, user_lat: float | None = None, user_lng: float | None = None) -> SafePlaceOut:
    dist = None
    if user_lat is not None and user_lng is not None:
        dist = int(haversine_meters(user_lat, user_lng, place.lat, place.lng))
    return SafePlaceOut(
        id=place.id,
        name=place.name,
        kind=place.kind,
        lat=place.lat,
        lng=place.lng,
        address=place.address,
        is_open=place.is_open,
        verification_level=place.verification_level,
        distance_meters=dist,
    )


class SafePlaceService:
    def __init__(self, db: AsyncSession) -> None:
        self._repo = SafePlaceRepository(db)

    async def list_nearby(
        self,
        lat: float | None = None,
        lng: float | None = None,
        radius_meters: float = 2000.0,
        kind: str | None = None,
    ) -> list[SafePlaceOut]:
        places = await self._repo.list_all(kind=kind)
        results = []
        for p in places:
            if lat is not None and lng is not None:
                dist = haversine_meters(lat, lng, p.lat, p.lng)
                if dist > radius_meters:
                    continue
                out = _to_out(p, lat, lng)
            else:
                out = _to_out(p)
            results.append(out)

        # Sort by distance ascending if we have a location
        if lat is not None:
            results.sort(key=lambda x: x.distance_meters or 0)
        return results

    async def get(self, place_id: str, user_lat: float | None = None, user_lng: float | None = None) -> SafePlaceOut:
        place = await self._repo.get_by_id(place_id)
        if not place:
            raise safe_place_not_found()
        return _to_out(place, user_lat, user_lng)

    async def create(self, req: CreateSafePlaceRequest, user_id: str, is_admin: bool = False) -> SafePlaceOut:
        level = "admin" if is_admin else "community"
        place = await self._repo.create(
            name=req.name,
            kind=req.kind,
            lat=req.lat,
            lng=req.lng,
            address=req.address,
            is_open=req.is_open,
            added_by=user_id,
            verification_level=level,
        )
        return _to_out(place)
