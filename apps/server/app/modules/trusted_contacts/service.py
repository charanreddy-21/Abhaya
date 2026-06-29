"""
Trusted Contacts & Echo service.

Responsibilities:
  - CRUD for a user's trusted contacts (max 5)
  - Echo dispatch: send SMS / WhatsApp to contacts on SOS activation
    or Safe Trip expiry
  - Phone numbers are masked before returning to the client
  - Raw phone numbers never appear in API responses or logs
"""

import logging
import re
from typing import Optional

from .schemas import (
    ContactChannel,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    EchoDispatchResult,
)

logger = logging.getLogger(__name__)

MAX_CONTACTS_PER_USER = 5
_MASK_RE = re.compile(r"(\+?\d{2,4})\d+(\d{4})")


def _mask_phone(number: str) -> str:
    m = _MASK_RE.match(number)
    if m:
        return f"{m.group(1)} ••••••{m.group(2)}"
    return "•" * (len(number) - 4) + number[-4:]


def _maps_link(lat: Optional[float], lng: Optional[float]) -> str:
    if lat is None or lng is None:
        return "Location unavailable"
    return f"https://maps.google.com/?q={lat},{lng}"


def _now_ist() -> str:
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST")


class TrustedContactsService:
    def __init__(self, repo, sms_provider=None, whatsapp_provider=None):
        self._repo = repo
        self._sms = sms_provider
        self._wa = whatsapp_provider

    # ── Contact management ─────────────────────────────────────────── #

    async def list_contacts(self, user_id: str) -> list[ContactResponse]:
        rows = await self._repo.list_for_user(user_id)
        return [self._to_response(r) for r in rows]

    async def add_contact(self, user_id: str, payload: ContactCreate) -> ContactResponse:
        existing = await self._repo.list_for_user(user_id)
        if len(existing) >= MAX_CONTACTS_PER_USER:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": {
                        "code": "CONTACTS_LIMIT_REACHED",
                        "message": f"You can have up to {MAX_CONTACTS_PER_USER} trusted contacts.",
                        "details": {},
                        "request-id": "",
                    }
                },
            )
        row = await self._repo.create(
            user_id=user_id,
            name=payload.name,
            phone_number=payload.phone_number,
            channel=payload.channel.value,
        )
        logger.info("contact_added", extra={"user_id": user_id, "contact_id": row["id"]})
        return self._to_response(row)

    async def update_contact(
        self, contact_id: str, user_id: str, payload: ContactUpdate
    ) -> ContactResponse:
        row = await self._get_owned_contact(contact_id, user_id)
        updates = payload.model_dump(exclude_none=True)
        if updates:
            row = await self._repo.update(contact_id, **updates)
        return self._to_response(row)

    async def delete_contact(self, contact_id: str, user_id: str) -> None:
        await self._get_owned_contact(contact_id, user_id)
        await self._repo.delete(contact_id)
        logger.info("contact_deleted", extra={"user_id": user_id, "contact_id": contact_id})

    # ── Echo dispatch ──────────────────────────────────────────────── #

    async def dispatch_sos_active(
        self,
        user_id: str,
        incident_id: str,
        latitude: Optional[float],
        longitude: Optional[float],
    ) -> list[EchoDispatchResult]:
        contacts = await self._repo.list_for_user(user_id)
        if not contacts:
            return []
        maps_link = _maps_link(latitude, longitude)
        message = (
            f"🚨 Abhaya Safety Alert\n\n"
            f"Someone you know has triggered an emergency.\n"
            f"Last known location: {maps_link}\n"
            f"Time: {_now_ist()}\n\n"
            f"Please try to contact them or call 112 if you cannot reach them.\n"
            f"Sent via Abhaya safety app."
        )
        return await self._dispatch_all(contacts, message, incident_id=incident_id)

    async def dispatch_trip_overdue(
        self,
        user_id: str,
        trip: dict,
        incident_id: Optional[str],
    ) -> list[EchoDispatchResult]:
        contacts = await self._repo.list_for_user(user_id)
        if not contacts:
            return []
        destination = trip.get("destination_label", "their destination")
        maps_link = _maps_link(trip.get("latitude"), trip.get("longitude"))
        message = (
            f"⚠️ Abhaya Check-In Missed\n\n"
            f"Someone you know was travelling to {destination} and has not checked in.\n"
        )
        if maps_link:
            message += f"Last known location: {maps_link}\n"
        message += (
            f"Time: {_now_ist()}\n\n"
            f"Please try calling them. If you cannot reach them, consider calling 112.\n"
            f"Sent via Abhaya safety app."
        )
        return await self._dispatch_all(contacts, message, incident_id=incident_id)

    # ── Internal helpers ───────────────────────────────────────────── #

    async def _dispatch_all(
        self,
        contacts: list[dict],
        message: str,
        *,
        incident_id: Optional[str] = None,
    ) -> list[EchoDispatchResult]:
        results = []
        for contact in contacts:
            result = await self._dispatch_one(contact, message)
            logger.info(
                "echo_dispatch",
                extra={
                    "contact_id": contact["id"],
                    "channel": contact["channel"],
                    "delivered": result.delivered,
                    "incident_id": incident_id,
                },
            )
            results.append(result)
        return results

    async def _dispatch_one(self, contact: dict, message: str) -> EchoDispatchResult:
        phone = contact["phone_number"]
        channel = contact["channel"]
        try:
            if channel == ContactChannel.whatsapp.value and self._wa:
                await self._wa.send(to=phone, body=message)
                return EchoDispatchResult(
                    contact_id=contact["id"],
                    contact_name=contact["name"],
                    channel=ContactChannel.whatsapp,
                    delivered=True,
                )
            elif self._sms:
                await self._sms.send(to=phone, body=message)
                return EchoDispatchResult(
                    contact_id=contact["id"],
                    contact_name=contact["name"],
                    channel=ContactChannel.sms,
                    delivered=True,
                )
            else:
                return EchoDispatchResult(
                    contact_id=contact["id"],
                    contact_name=contact["name"],
                    channel=ContactChannel(channel),
                    delivered=False,
                    error="PROVIDER_NOT_CONFIGURED",
                )
        except Exception as exc:
            logger.exception("echo_send_failed", extra={"contact_id": contact["id"]})
            return EchoDispatchResult(
                contact_id=contact["id"],
                contact_name=contact["name"],
                channel=ContactChannel(channel),
                delivered=False,
                error=str(exc)[:120],
            )

    async def _get_owned_contact(self, contact_id: str, user_id: str) -> dict:
        from fastapi import HTTPException, status
        contact = await self._repo.get_by_id(contact_id)
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "CONTACT_NOT_FOUND",
                        "message": "We couldn't find that contact.",
                        "details": {},
                        "request-id": "",
                    }
                },
            )
        if contact["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "AUTH_FORBIDDEN",
                        "message": "You do not have permission to do that.",
                        "details": {},
                        "request-id": "",
                    }
                },
            )
        return contact

    def _to_response(self, row: dict) -> ContactResponse:
        return ContactResponse(
            id=row["id"],
            user_id=row["user_id"],
            name=row["name"],
            phone_number_masked=_mask_phone(row["phone_number"]),
            channel=ContactChannel(row["channel"]),
            created_at=str(row.get("created_at", "")),
        )