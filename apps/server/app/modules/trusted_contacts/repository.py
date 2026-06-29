"""
Trusted Contacts repository.

All database access lives here — services never touch SQL directly.
Accepts a session_factory so the service can be wired once at startup.
"""

from datetime import datetime, timezone
from typing import Optional, Callable, Any
import uuid


class TrustedContactsRepository:
    def __init__(self, session_factory: Callable[[], Any]):
        self._session_factory = session_factory

    async def list_for_user(self, user_id: str) -> list[dict]:
        # TODO: SELECT * FROM trusted_contacts WHERE user_id = :user_id
        return []

    async def get_by_id(self, contact_id: str) -> Optional[dict]:
        # TODO: SELECT * FROM trusted_contacts WHERE id = :contact_id
        return None

    async def create(
        self,
        user_id: str,
        name: str,
        phone_number: str,
        channel: str,
    ) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": name,
            "phone_number": phone_number,  # stored encrypted in real impl
            "channel": channel,
            "created_at": now,
        }
        # TODO: persist to trusted_contacts table
        return row

    async def update(self, contact_id: str, **kwargs) -> dict:
        # TODO: UPDATE trusted_contacts SET ... WHERE id = :contact_id
        raise NotImplementedError("trusted_contacts table not yet migrated")

    async def delete(self, contact_id: str) -> None:
        # TODO: DELETE FROM trusted_contacts WHERE id = :contact_id
        raise NotImplementedError("trusted_contacts table not yet migrated")