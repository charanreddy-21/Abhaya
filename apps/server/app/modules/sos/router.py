from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.database import get_db
from apps.server.app.core.security import get_current_user
from apps.server.app.modules.sos.schemas import CreateSOSRequest, IncidentListOut, IncidentOut
from apps.server.app.modules.sos.service import SOSService

router = APIRouter(prefix="/api/sos", tags=["sos"])


@router.post("", response_model=IncidentOut, status_code=201)
async def create_sos(
    req: CreateSOSRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SOSService(db).create(user.id, req)


@router.get("/active", response_model=list[IncidentOut])
async def list_active(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await SOSService(db).list_active(user.id)


@router.get("/history", response_model=list[IncidentOut])
async def list_history(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await SOSService(db).list_all(user.id)


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_sos(incident_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await SOSService(db).get(incident_id, user.id)


@router.post("/{incident_id}/resolve", response_model=IncidentOut)
async def resolve_sos(incident_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await SOSService(db).resolve(incident_id, user.id)
