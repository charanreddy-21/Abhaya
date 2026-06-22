"""Push notification endpoints — stub for hackathon (no real push delivery yet)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.database import get_db
from apps.server.app.core.security import get_current_user
from apps.server.app.modules.auth.repository import UserRepository

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class PushSubscriptionRequest(BaseModel):
    endpoint: str


@router.post("/subscribe", status_code=204)
async def subscribe(
    req: PushSubscriptionRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save push endpoint for future use. Real delivery not yet implemented."""
    repo = UserRepository(db)
    await repo.update(user, push_endpoint=req.endpoint)


@router.delete("/subscribe", status_code=204)
async def unsubscribe(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    await repo.update(user, push_endpoint=None)
