from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.database import get_db
from apps.server.app.core.security import get_current_user
from apps.server.app.modules.witness_alerts.schemas import WitnessAlertOut
from apps.server.app.modules.witness_alerts.service import WitnessAlertService

router = APIRouter(prefix="/api/witness", tags=["witness"])


@router.get("/alerts", response_model=list[WitnessAlertOut])
async def list_alerts(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await WitnessAlertService(db).list_for_witness(user.id)


@router.post("/alerts/{alert_id}/acknowledge", response_model=WitnessAlertOut)
async def acknowledge(alert_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await WitnessAlertService(db).acknowledge(alert_id, user.id)


@router.post("/alerts/{alert_id}/reveal", response_model=WitnessAlertOut)
async def reveal(alert_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await WitnessAlertService(db).reveal(alert_id, user.id)
