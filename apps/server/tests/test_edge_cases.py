import asyncio
import hashlib
import json
from datetime import datetime, timedelta, timezone

from apps.server.tests.conftest import register_user


def _headers(auth: dict) -> dict:
    return {"Authorization": f"Bearer {auth['token']['access_token']}"}


def test_users_cannot_access_each_others_contacts_or_trips(client):
    owner = register_user(client, "owner@example.com")
    other = register_user(client, "other@example.com")
    owner_headers = _headers(owner)
    other_headers = _headers(other)

    contact = client.post(
        "/api/contacts/",
        headers=owner_headers,
        json={"name": "Owner Contact", "phone_number": "+919800000001", "channel": "sms"},
    )
    assert contact.status_code == 201, contact.text
    forbidden_contact = client.patch(
        f"/api/contacts/{contact.json()['id']}",
        headers=other_headers,
        json={"name": "Taken"},
    )
    assert forbidden_contact.status_code == 403
    assert forbidden_contact.json()["error"]["code"] == "FORBIDDEN"

    eta = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    trip = client.post(
        "/api/trips/",
        headers=owner_headers,
        json={"destination_label": "Home", "expected_arrival_at": eta},
    )
    assert trip.status_code == 201, trip.text
    forbidden_trip = client.get(f"/api/trips/{trip.json()['id']}", headers=other_headers)
    assert forbidden_trip.status_code == 403
    assert forbidden_trip.json()["error"]["code"] == "FORBIDDEN"


def test_contact_update_cannot_duplicate_existing_phone(client):
    auth = register_user(client, "contact-update@example.com")
    headers = _headers(auth)
    first = client.post(
        "/api/contacts/",
        headers=headers,
        json={"name": "First", "phone_number": "+919800000011", "channel": "sms"},
    )
    second = client.post(
        "/api/contacts/",
        headers=headers,
        json={"name": "Second", "phone_number": "+919800000022", "channel": "sms"},
    )
    assert first.status_code == 201
    assert second.status_code == 201

    duplicate_update = client.patch(
        f"/api/contacts/{second.json()['id']}",
        headers=headers,
        json={"phone_number": "+919800000011"},
    )
    assert duplicate_update.status_code == 409
    assert duplicate_update.json()["error"]["code"] == "CONTACT_ALREADY_EXISTS"


def test_safe_trip_scheduler_escalates_overdue_trip_and_creates_sos(client):
    auth = register_user(client, "scheduler@example.com")
    headers = _headers(auth)
    user_id = auth["user"]["id"]

    async def arrange_and_run_scheduler():
        service = client.app.state.safe_trip_service
        trip = await service._repo.create(
            user_id=user_id,
            destination_label="Metro station",
            expected_arrival_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            latitude=12.9352,
            longitude=77.6245,
        )
        await service.check_due_pings()
        pending = await service._repo.get_by_id(trip["id"])
        assert pending["status"] == "pending_checkin"
        await service._repo.set_status(
            trip["id"],
            "pending_checkin",
            ping_deadline_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        )
        await service.check_due_escalations()
        return await service._repo.get_by_id(trip["id"])

    escalated = asyncio.run(arrange_and_run_scheduler())
    assert escalated["status"] == "escalated"
    assert escalated["incident_id"]

    active_sos = client.get("/api/sos/active", headers=headers)
    assert active_sos.status_code == 200
    assert active_sos.json()[0]["id"] == escalated["incident_id"]


def test_evidence_rejects_non_media_uploads(client):
    auth = register_user(client, "unsupported-evidence@example.com")
    headers = _headers(auth)
    incident = client.post(
        "/api/sos",
        headers=headers,
        json={
            "lat": 12.9352,
            "lng": 77.6245,
            "accuracy_meters": 20,
            "location_captured_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert incident.status_code == 201
    contents = b"plain text evidence"
    meta = {
        "incident_id": incident.json()["id"],
        "kind": "audio",
        "label": "Wrong type",
        "sha256_hash": hashlib.sha256(contents).hexdigest(),
    }
    response = client.post(
        "/api/evidence",
        headers=headers,
        data={"meta": json.dumps(meta)},
        files={"file": ("note.txt", contents, "text/plain")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "EVIDENCE_UNSUPPORTED_TYPE"
