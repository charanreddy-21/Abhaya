import hashlib
import json
import os
import pathlib

import aiofiles
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.config import settings
from apps.server.app.modules.evidence.repository import EvidenceRepository
from apps.server.app.modules.evidence.schemas import EvidenceOut, EvidenceUploadMeta
from apps.server.app.modules.sos.repository import SOSRepository
from apps.server.app.shared.errors import (
    evidence_hash_mismatch,
    evidence_limit_reached,
    evidence_not_found,
    evidence_too_large,
    evidence_unsupported_type,
    forbidden,
    sos_not_found,
)
from apps.server.app.shared.models import AuditEvent

ALLOWED_MIME_PREFIXES = ("video/", "audio/", "image/")


def _to_out(item) -> EvidenceOut:
    return EvidenceOut.model_validate(item)


class EvidenceService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._repo = EvidenceRepository(db)
        self._sos_repo = SOSRepository(db)
        self._upload_dir = pathlib.Path(settings.evidence_upload_dir)
        self._upload_dir.mkdir(parents=True, exist_ok=True)

    async def upload(self, meta: EvidenceUploadMeta, file: UploadFile, user_id: str) -> EvidenceOut:
        # Verify the incident exists and belongs to this user
        incident = await self._sos_repo.get_by_id(meta.incident_id)
        if not incident:
            raise sos_not_found()
        if incident.user_id != user_id:
            raise forbidden("this incident")

        # Check per-incident limit
        count = await self._repo.count_for_incident(meta.incident_id)
        if count >= settings.max_evidence_per_incident:
            raise evidence_limit_reached()

        if file.content_type and not file.content_type.startswith(ALLOWED_MIME_PREFIXES):
            raise evidence_unsupported_type()

        # Read file into memory to check size and hash
        contents = await file.read()
        size_bytes = len(contents)

        if size_bytes > settings.max_evidence_size_bytes:
            raise evidence_too_large(settings.max_evidence_size_bytes // (1024 * 1024))

        # Verify hash matches what client declared
        actual_hash = hashlib.sha256(contents).hexdigest()
        if actual_hash != meta.sha256_hash:
            raise evidence_hash_mismatch()

        # Determine file extension from content type or original filename
        ext = _ext_for(file.content_type, file.filename)

        # Write to disk
        from apps.server.app.shared.models import EvidenceItem
        import uuid
        evidence_id = uuid.uuid4().hex
        filename = f"{evidence_id}{ext}"
        dest = self._upload_dir / filename

        async with aiofiles.open(dest, "wb") as f:
            await f.write(contents)

        item = await self._repo.create(
            incident_id=meta.incident_id,
            user_id=user_id,
            kind=meta.kind,
            label=meta.label,
            filename=filename,
            size_bytes=size_bytes,
            sha256_hash=actual_hash,
        )

        # Immediately "anchor" the hash (in production: submit to OpenTimestamps)
        item = await self._repo.anchor(item)

        audit = AuditEvent(
            actor_id=user_id,
            action="evidence.upload",
            resource_type="evidence",
            resource_id=item.id,
            metadata_json=json.dumps({
                "incident_id": meta.incident_id,
                "kind": meta.kind,
                "size_bytes": size_bytes,
                "sha256_hash": actual_hash,
            }),
        )
        self._db.add(audit)
        await self._db.commit()

        return _to_out(item)

    async def list_for_user(self, user_id: str) -> list[EvidenceOut]:
        items = await self._repo.list_for_user(user_id)
        return [_to_out(i) for i in items]

    async def delete(self, evidence_id: str, user_id: str) -> None:
        item = await self._repo.get_by_id(evidence_id)
        if not item:
            raise evidence_not_found()
        if item.user_id != user_id:
            raise forbidden("this evidence item")

        # Delete from disk (best-effort)
        dest = self._upload_dir / item.filename
        try:
            if dest.exists():
                dest.unlink()
        except OSError:
            pass

        await self._repo.delete(item)

        audit = AuditEvent(
            actor_id=user_id,
            action="evidence.delete",
            resource_type="evidence",
            resource_id=evidence_id,
            metadata_json=json.dumps({
                "kind": item.kind,
                "label": item.label,
                "sha256_hash": item.sha256_hash,
            }),
        )
        self._db.add(audit)
        await self._db.commit()

    async def get_file_path(self, evidence_id: str, user_id: str) -> pathlib.Path:
        item = await self._repo.get_by_id(evidence_id)
        if not item:
            raise evidence_not_found()
        if item.user_id != user_id:
            raise forbidden("this evidence item")
        path = self._upload_dir / item.filename
        if not path.exists():
            raise evidence_not_found()
        return path


def _ext_for(content_type: str | None, filename: str | None) -> str:
    if filename:
        _, ext = os.path.splitext(filename)
        if ext:
            return ext.lower()
    if content_type:
        ct = content_type.lower()
        if "mp4" in ct or "video" in ct:
            return ".mp4"
        if "webm" in ct:
            return ".webm"
        if "ogg" in ct or "audio" in ct:
            return ".ogg"
        if "jpeg" in ct or "jpg" in ct:
            return ".jpg"
        if "png" in ct:
            return ".png"
    return ".bin"
