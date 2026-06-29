import hashlib
from datetime import datetime, timedelta, timezone

from apps.server.tests.conftest import register_user


def test_validation_errors_use_standard_shape(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "bad-email", "password": "password", "display_name": ""},
    )

    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["code"] == "VALIDATION_ERROR"
    assert payload["error"]["message"] == "Check the highlighted details and try again."
    assert payload["error"]["request_id"].startswith("req_")
    assert payload["error"]["request-id"] == payload["error"]["request_id"]
    assert payload["error"]["details"]["fields"]


def test_trusted_contacts_persist_mask_and_enforce_limits(client):
    auth = register_user(client, "contacts@example.com")
    headers = {"Authorization": f"Bearer {auth['token']['access_token']}"}

    created = client.post(
        "/api/contacts/",
        headers=headers,
        json={"name": "Priya", "phone_number": "+919876543210", "channel": "sms"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["phone_number_masked"].endswith("3210")
    assert "phone_number" not in body

    duplicate = client.post(
        "/api/contacts/",
        headers=headers,
        json={"name": "Priya duplicate", "phone_number": "+919876543210", "channel": "sms"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "CONTACT_ALREADY_EXISTS"

    for index in range(4):
        response = client.post(
            "/api/contacts/",
            headers=headers,
            json={
                "name": f"Contact {index}",
                "phone_number": f"+91987654322{index}",
                "channel": "whatsapp",
            },
        )
        assert response.status_code == 201, response.text

    over_limit = client.post(
        "/api/contacts/",
        headers=headers,
        json={"name": "Too many", "phone_number": "+919876543299", "channel": "sms"},
    )
    assert over_limit.status_code == 422
    assert over_limit.json()["error"]["code"] == "CONTACTS_LIMIT_REACHED"

    listed = client.get("/api/contacts/", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 5
    assert all("phone_number" not in contact for contact in listed.json())

    contact_id = body["id"]
    deleted = client.delete(f"/api/contacts/{contact_id}", headers=headers)
    assert deleted.status_code == 204
    listed = client.get("/api/contacts/", headers=headers)
    assert len(listed.json()) == 4


def test_sos_rejects_stale_or_poor_location_and_reuses_active_incident(client):
    auth = register_user(client, "sos@example.com")
    headers = {"Authorization": f"Bearer {auth['token']['access_token']}"}
    stale_time = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()

    stale = client.post(
        "/api/sos",
        headers=headers,
        json={
            "lat": 12.9352,
            "lng": 77.6245,
            "accuracy_meters": 50,
            "location_captured_at": stale_time,
        },
    )
    assert stale.status_code == 422
    assert stale.json()["error"]["code"] == "SOS_LOCATION_STALE"

    poor = client.post(
        "/api/sos",
        headers=headers,
        json={
            "lat": 12.9352,
            "lng": 77.6245,
            "accuracy_meters": 9999,
            "location_captured_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert poor.status_code == 422
    assert poor.json()["error"]["code"] == "SOS_LOCATION_POOR_ACCURACY"

    valid_payload = {
        "lat": 12.9352,
        "lng": 77.6245,
        "accuracy_meters": 25,
        "location_captured_at": datetime.now(timezone.utc).isoformat(),
    }
    first = client.post("/api/sos", headers=headers, json=valid_payload)
    assert first.status_code == 201, first.text
    second = client.post("/api/sos", headers=headers, json={**valid_payload, "accuracy_meters": 9999})
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]


def test_safe_trip_lifecycle_and_terminal_errors(client):
    auth = register_user(client, "trip@example.com")
    headers = {"Authorization": f"Bearer {auth['token']['access_token']}"}
    eta = (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat()

    created = client.post(
        "/api/trips/",
        headers=headers,
        json={
            "destination_label": "Home",
            "expected_arrival_at": eta,
            "latitude": 12.9352,
            "longitude": 77.6245,
        },
    )
    assert created.status_code == 201, created.text
    trip_id = created.json()["id"]

    active = client.get("/api/trips/active", headers=headers)
    assert active.status_code == 200
    assert active.json()["id"] == trip_id

    duplicate = client.post(
        "/api/trips/",
        headers=headers,
        json={"destination_label": "Office", "expected_arrival_at": eta},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "TRIP_ALREADY_ACTIVE"

    extended = client.post(f"/api/trips/{trip_id}/extend", headers=headers, json={"extend_minutes": 5})
    assert extended.status_code == 200
    assert extended.json()["status"] == "active"

    resolved = client.post(f"/api/trips/{trip_id}/checkin", headers=headers)
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"

    terminal = client.post(f"/api/trips/{trip_id}/checkin", headers=headers)
    assert terminal.status_code == 409
    assert terminal.json()["error"]["code"] == "TRIP_ALREADY_TERMINAL"


def test_evidence_upload_checks_hash_and_preserves_metadata(client):
    auth = register_user(client, "evidence@example.com")
    headers = {"Authorization": f"Bearer {auth['token']['access_token']}"}
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
    assert incident.status_code == 201, incident.text
    incident_id = incident.json()["id"]
    contents = b"test evidence bytes"
    good_hash = hashlib.sha256(contents).hexdigest()

    bad_meta = {
        "incident_id": incident_id,
        "kind": "audio",
        "label": "Mismatch",
        "sha256_hash": "0" * 64,
    }
    bad = client.post(
        "/api/evidence",
        headers=headers,
        data={"meta": __import__("json").dumps(bad_meta)},
        files={"file": ("clip.ogg", contents, "audio/ogg")},
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "EVIDENCE_HASH_MISMATCH"

    good_meta = {**bad_meta, "label": "Audio clip", "sha256_hash": good_hash}
    uploaded = client.post(
        "/api/evidence",
        headers=headers,
        data={"meta": __import__("json").dumps(good_meta)},
        files={"file": ("clip.ogg", contents, "audio/ogg")},
    )
    assert uploaded.status_code == 201, uploaded.text
    item = uploaded.json()
    assert item["incident_id"] == incident_id
    assert item["sha256_hash"] == good_hash
    assert item["anchored"] is True
    assert "filename" not in item
