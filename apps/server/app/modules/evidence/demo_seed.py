"""Demo evidence helpers for local prototype data."""

import hashlib
import pathlib
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.server.app.core.config import settings
from apps.server.app.shared.models import EvidenceItem, Incident

_DEMO_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe"
    b"\x02\xfe\xa7\x35\x81\x84\x00\x00\x00\x00IEND\xaeB`\x82"
)
_DEMO_HASH = hashlib.sha256(_DEMO_PNG_BYTES).hexdigest()


async def attach_dummy_evidence_if_missing(db: AsyncSession, incident: Incident) -> None:
    """Attach one harmless demo evidence file to an incident with no evidence."""
    if incident.evidence_items:
        return

    upload_dir = pathlib.Path(settings.evidence_upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"demo-evidence-{incident.id}.png"
    path = upload_dir / filename
    if not path.exists():
        path.write_bytes(_DEMO_PNG_BYTES)

    db.add(
        EvidenceItem(
            incident_id=incident.id,
            user_id=incident.user_id,
            kind="photo",
            label="Demo evidence placeholder",
            filename=filename,
            size_bytes=len(_DEMO_PNG_BYTES),
            sha256_hash=_DEMO_HASH,
            anchored=True,
            upload_status="uploaded",
            created_at=datetime.now(timezone.utc),
        )
    )


async def seed_dummy_evidence_for_all_incidents(db: AsyncSession) -> None:
    """Backfill demo evidence for existing incidents that do not have any."""
    result = await db.execute(
        select(Incident).options(selectinload(Incident.evidence_items))
    )
    incidents = list(result.scalars().all())
    for incident in incidents:
        await attach_dummy_evidence_if_missing(db, incident)
    await db.commit()
