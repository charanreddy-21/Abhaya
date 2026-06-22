from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.database import get_db
from apps.server.app.core.security import require_admin
from apps.server.app.modules.admin.schemas import (
    AdminIncidentDetailOut,
    AdminIncidentOut,
    AuditLogPage,
    SystemMetricsOut,
)
from apps.server.app.modules.admin.service import AdminService
from apps.server.app.modules.safe_places.schemas import SafePlaceOut
from apps.server.app.modules.safe_places.service import SafePlaceService

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/metrics", response_model=SystemMetricsOut)
async def metrics(admin=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return await AdminService(db).get_metrics()


@router.get("/incidents", response_model=list[AdminIncidentOut])
async def list_incidents(
    status: str | None = Query(None, pattern="^(active|resolved)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await AdminService(db).list_incidents(status=status, limit=limit, offset=offset)


@router.get("/incidents/{incident_id}", response_model=AdminIncidentDetailOut)
async def get_incident(
    incident_id: str,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await AdminService(db).get_incident_detail(incident_id, admin.id, admin.email)


@router.post("/incidents/{incident_id}/resolve", response_model=AdminIncidentOut)
async def resolve_incident(
    incident_id: str,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await AdminService(db).resolve_incident(incident_id, admin.id)


@router.get("/audit", response_model=AuditLogPage)
async def list_audit_log(
    action: str | None = Query(None, description="Filter by action prefix, e.g. 'auth', 'sos', 'admin'"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await AdminService(db).list_audit_log(action_prefix=action, limit=limit, offset=offset)


# ── Safe Place admin management ────────────────────────────────────────────────

@router.patch("/safe-places/{place_id}/verify", response_model=SafePlaceOut)
async def admin_verify_safe_place(
    place_id: str,
    level: str = Body(..., embed=True, pattern="^(unverified|community|admin)$"),
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await SafePlaceService(db).verify(place_id, admin.id, level)


@router.patch("/safe-places/{place_id}/open", response_model=SafePlaceOut)
async def admin_set_safe_place_open(
    place_id: str,
    is_open: bool = Body(..., embed=True),
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await SafePlaceService(db).set_open(place_id, admin.id, is_open)


@router.delete("/safe-places/{place_id}", status_code=204)
async def admin_delete_safe_place(
    place_id: str,
    admin=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    await SafePlaceService(db).delete_place(place_id, admin.id)
