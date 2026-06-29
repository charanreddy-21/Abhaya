"""
Trusted Contacts repository.

All database access lives here — services never touch SQL directly.
Accepts a session_factory so the service can be wired once at startup.
"""

from datetime import datetime, timezone
from typing import Optional, Callable, Any

from sqlalchemy import delete, select

from apps.server.app.shared.models import TrustedContact


class TrustedContactsRepository:
    def __init__(self, session_factory: Callable[[], Any]):
        self._session_factory = session_factory

    async def list_for_user(self, user_id: str) -> list[dict]:
        async with self._session_factory() as db:
            result = await db.execute(
                select(TrustedContact)
                .where(TrustedContact.user_id == user_id)
                .order_by(TrustedContact.created_at.asc())
            )
            return [_to_dict(row) for row in result.scalars().all()]

    async def get_by_id(self, contact_id: str) -> Optional[dict]:
        async with self._session_factory() as db:
            result = await db.execute(select(TrustedContact).where(TrustedContact.id == contact_id))
            row = result.scalar_one_or_none()
            return _to_dict(row) if row else None

    async def create(
        self,
        user_id: str,
        name: str,
        phone_number: str,
        channel: str,
    ) -> dict:
        async with self._session_factory() as db:
            row = TrustedContact(
                user_id=user_id,
                name=name,
                phone_number=phone_number,
                channel=channel,
            )
            db.add(row)
            await db.commit()
            await db.refresh(row)
            return _to_dict(row)

    async def update(self, contact_id: str, **kwargs) -> dict:
        async with self._session_factory() as db:
            result = await db.execute(select(TrustedContact).where(TrustedContact.id == contact_id))
            row = result.scalar_one()
            for key, value in kwargs.items():
                if hasattr(row, key):
                    setattr(row, key, value)
            row.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(row)
            return _to_dict(row)

    async def delete(self, contact_id: str) -> None:
        async with self._session_factory() as db:
            await db.execute(delete(TrustedContact).where(TrustedContact.id == contact_id))
            await db.commit()


def _to_dict(row: TrustedContact) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "name": row.name,
        "phone_number": row.phone_number,
        "channel": row.channel,
        "created_at": row.created_at,
    }
