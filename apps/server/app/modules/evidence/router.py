import json

from fastapi import APIRouter, Depends, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.database import get_db
from apps.server.app.core.security import get_current_user
from apps.server.app.modules.evidence.schemas import EvidenceOut, EvidenceUploadMeta
from apps.server.app.modules.evidence.service import EvidenceService

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.post("", response_model=EvidenceOut, status_code=201)
async def upload_evidence(
    meta: str = Form(..., description="JSON-encoded EvidenceUploadMeta"),
    file: UploadFile = ...,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    meta_obj = EvidenceUploadMeta.model_validate(json.loads(meta))
    return await EvidenceService(db).upload(meta_obj, file, user.id)


@router.get("", response_model=list[EvidenceOut])
async def list_evidence(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await EvidenceService(db).list_for_user(user.id)


@router.delete("/{evidence_id}", status_code=204)
async def delete_evidence(evidence_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await EvidenceService(db).delete(evidence_id, user.id)


@router.get("/{evidence_id}/download")
async def download_evidence(evidence_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    path = await EvidenceService(db).get_file_path(evidence_id, user.id)
    return FileResponse(path=str(path), filename=path.name)
