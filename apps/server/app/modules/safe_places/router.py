from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.database import get_db
from apps.server.app.core.security import get_current_user
from apps.server.app.modules.safe_places.schemas import CreateSafePlaceRequest, SafePlaceOut
from apps.server.app.modules.safe_places.service import SafePlaceService

router = APIRouter(prefix="/api/safe-places", tags=["safe-places"])


@router.get("", response_model=list[SafePlaceOut])
async def list_safe_places(
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    radius: float = Query(2000.0, ge=100, le=50_000),
    kind: str | None = Query(None, pattern="^(police|hospital|pharmacy|petrol|shelter)$"),
    db: AsyncSession = Depends(get_db),
):
    return await SafePlaceService(db).list_nearby(lat, lng, radius, kind)


@router.get("/{place_id}", response_model=SafePlaceOut)
async def get_safe_place(
    place_id: str,
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await SafePlaceService(db).get(place_id, lat, lng)


@router.post("", response_model=SafePlaceOut, status_code=201)
async def create_safe_place(
    req: CreateSafePlaceRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    is_admin = user.role == "admin"
    return await SafePlaceService(db).create(req, user.id, is_admin)
