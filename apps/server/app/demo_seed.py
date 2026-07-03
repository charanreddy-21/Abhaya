"""Idempotent demo data for the hackathon walkthrough."""

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.server.app.core.security import hash_password
from apps.server.app.modules.evidence.demo_seed import (
    attach_dummy_evidence_if_missing,
    seed_dummy_evidence_for_all_incidents,
)
from apps.server.app.shared.models import (
    AuditEvent,
    Incident,
    SafePlace,
    TripMonitor,
    TrustedContact,
    User,
    WitnessAlert,
)

DEMO_USER_EMAIL = "demo@abhaya.in"
DEMO_ADMIN_EMAIL = "admin@abhaya.in"
DEMO_WITNESS_EMAIL = "witness@abhaya.in"


async def seed_demo_data(db: AsyncSession) -> None:
    """Create a complete, repeatable demo baseline."""
    demo_user = await _ensure_user(
        db,
        email=DEMO_USER_EMAIL,
        password="demo1234",
        display_name="Demo User",
        role="user",
        witness_opt_in=True,
    )
    demo_admin = await _ensure_user(
        db,
        email=DEMO_ADMIN_EMAIL,
        password="admin1234",
        display_name="Admin User",
        role="admin",
        witness_opt_in=False,
    )
    witness_user = await _ensure_user(
        db,
        email=DEMO_WITNESS_EMAIL,
        password="witness1234",
        display_name="Priya Sharma",
        role="user",
        witness_opt_in=True,
    )

    await _ensure_safe_places(db, demo_admin.id)
    await _ensure_contacts(db, demo_user.id)
    active_incident = await _ensure_active_incident(db, demo_user.id)
    resolved_incident = await _ensure_resolved_incident(db, demo_user.id)
    await _ensure_witness_alert(db, active_incident.id, witness_user.id, status="acknowledged")
    await _ensure_witness_alert(db, resolved_incident.id, witness_user.id, status="revealed")
    await _ensure_active_trip(db, demo_user.id)

    for incident in (active_incident, resolved_incident):
        await attach_dummy_evidence_if_missing(db, incident)
        await _ensure_audit_event(
            db,
            actor_id=demo_user.id,
            action="sos.create",
            resource_type="incident",
            resource_id=incident.id,
            metadata={"seeded_demo": True, "accuracy_meters": incident.accuracy_meters},
        )

    await db.commit()
    await seed_dummy_evidence_for_all_incidents(db)


async def _ensure_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    display_name: str,
    role: str,
    witness_opt_in: bool,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.display_name = display_name
        user.role = role
        user.witness_opt_in = witness_opt_in
        return user

    user = User(
        email=email,
        hashed_password=hash_password(password),
        display_name=display_name,
        role=role,
        witness_opt_in=witness_opt_in,
    )
    db.add(user)
    await db.flush()
    return user


async def _ensure_safe_places(db: AsyncSession, admin_id: str) -> None:
    seed_places = [
        dict(name="Koramangala Police Station", kind="police", lat=12.9352, lng=77.6245,
             address="80 Feet Road, Koramangala 4th Block, Bengaluru 560034",
             is_open=True, verification_level="admin"),
        dict(name="Manipal Hospital HSR", kind="hospital", lat=12.9116, lng=77.6389,
             address="7 Outer Ring Road, HSR Layout, Bengaluru 560102",
             is_open=True, verification_level="admin"),
        dict(name="Apollo Pharmacy Koramangala", kind="pharmacy", lat=12.9342, lng=77.6255,
             address="2nd Main Rd, Koramangala 5th Block, Bengaluru 560095",
             is_open=True, verification_level="community"),
        dict(name="BPCL Petrol Station", kind="petrol", lat=12.9281, lng=77.6320,
             address="Sarjapur Road, Koramangala, Bengaluru 560095",
             is_open=True, verification_level="community"),
        dict(name="Forum Mall Security Post", kind="shelter", lat=12.9323, lng=77.6235,
             address="Hosur Rd, Koramangala, Bengaluru 560095",
             is_open=False, verification_level="community"),
        dict(name="Indiranagar Police Station", kind="police", lat=12.9784, lng=77.6408,
             address="100 Feet Road, Indiranagar, Bengaluru 560038",
             is_open=True, verification_level="admin"),
        dict(name="Jayadeva Hospital", kind="hospital", lat=12.9201, lng=77.5968,
             address="Bannerghatta Road, Jayanagar, Bengaluru 560041",
             is_open=True, verification_level="admin"),
    ]

    for place_data in seed_places:
        result = await db.execute(select(SafePlace).where(SafePlace.name == place_data["name"]))
        if result.scalar_one_or_none():
            continue
        db.add(SafePlace(**place_data, added_by=admin_id))


async def _ensure_contacts(db: AsyncSession, user_id: str) -> None:
    contacts = [
        ("Asha Rao", "+919876543210", "whatsapp"),
        ("Nikhil Mehta", "+919876543211", "sms"),
    ]
    for name, phone_number, channel in contacts:
        result = await db.execute(
            select(TrustedContact).where(
                TrustedContact.user_id == user_id,
                TrustedContact.phone_number == phone_number,
            )
        )
        if result.scalar_one_or_none():
            continue
        db.add(TrustedContact(user_id=user_id, name=name, phone_number=phone_number, channel=channel))


async def _ensure_active_incident(db: AsyncSession, user_id: str) -> Incident:
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.evidence_items))
        .where(Incident.user_id == user_id, Incident.status == "active")
        .order_by(Incident.created_at.desc())
        .limit(1)
    )
    incident = result.scalar_one_or_none()
    if incident:
        return incident

    incident = Incident(
        user_id=user_id,
        status="active",
        lat=12.9352,
        lng=77.6245,
        accuracy_meters=28,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=7),
    )
    db.add(incident)
    await db.flush()
    return await _reload_incident(db, incident.id)


async def _ensure_resolved_incident(db: AsyncSession, user_id: str) -> Incident:
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.evidence_items))
        .where(Incident.user_id == user_id, Incident.status == "resolved")
        .order_by(Incident.created_at.desc())
        .limit(1)
    )
    incident = result.scalar_one_or_none()
    if incident:
        return incident

    created_at = datetime.now(timezone.utc) - timedelta(days=1, hours=3)
    incident = Incident(
        user_id=user_id,
        status="resolved",
        lat=12.9323,
        lng=77.6235,
        accuracy_meters=42,
        created_at=created_at,
        resolved_at=created_at + timedelta(minutes=18),
    )
    db.add(incident)
    await db.flush()
    return await _reload_incident(db, incident.id)


async def _reload_incident(db: AsyncSession, incident_id: str) -> Incident:
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.evidence_items))
        .where(Incident.id == incident_id)
    )
    return result.scalar_one()


async def _ensure_witness_alert(
    db: AsyncSession,
    incident_id: str,
    witness_id: str,
    *,
    status: str,
) -> None:
    result = await db.execute(
        select(WitnessAlert).where(
            WitnessAlert.incident_id == incident_id,
            WitnessAlert.witness_id == witness_id,
        )
    )
    alert = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if alert:
        alert.status = status
        alert.acknowledged_at = now - timedelta(minutes=4) if status in ("acknowledged", "revealed") else None
        alert.revealed_at = now - timedelta(minutes=2) if status == "revealed" else None
        return

    db.add(
        WitnessAlert(
            incident_id=incident_id,
            witness_id=witness_id,
            status=status,
            distance_meters=240,
            acknowledged_at=now - timedelta(minutes=4) if status in ("acknowledged", "revealed") else None,
            revealed_at=now - timedelta(minutes=2) if status == "revealed" else None,
        )
    )


async def _ensure_active_trip(db: AsyncSession, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(TripMonitor)
        .where(
            TripMonitor.user_id == user_id,
            TripMonitor.status.not_in(("resolved", "cancelled", "escalated")),
        )
        .limit(1)
    )
    trip = result.scalar_one_or_none()
    if trip:
        trip.destination_label = "Home via Koramangala Metro"
        trip.status = "active"
        trip.expected_arrival_at = now + timedelta(minutes=18)
        trip.latitude = 12.9352
        trip.longitude = 77.6245
        trip.ping_sent_at = None
        trip.ping_deadline_at = None
        return

    db.add(
        TripMonitor(
            user_id=user_id,
            destination_label="Home via Koramangala Metro",
            status="active",
            expected_arrival_at=now + timedelta(minutes=18),
            latitude=12.9352,
            longitude=77.6245,
            created_at=now - timedelta(minutes=6),
        )
    )


async def _ensure_audit_event(
    db: AsyncSession,
    *,
    actor_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    metadata: dict,
) -> None:
    result = await db.execute(
        select(AuditEvent).where(
            AuditEvent.action == action,
            AuditEvent.resource_id == resource_id,
        )
    )
    if result.scalar_one_or_none():
        return
    db.add(
        AuditEvent(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=json.dumps(metadata),
        )
    )
