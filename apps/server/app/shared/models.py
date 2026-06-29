"""SQLAlchemy ORM models — single source of truth for all tables."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.server.app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="user")  # user | admin
    witness_opt_in: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    anonymous_by_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    push_endpoint: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)

    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="user", lazy="select")
    evidence_items: Mapped[list["EvidenceItem"]] = relationship("EvidenceItem", back_populates="user", lazy="select")
    witness_alerts: Mapped[list["WitnessAlert"]] = relationship(
        "WitnessAlert", foreign_keys="WitnessAlert.witness_id", back_populates="witness", lazy="select"
    )


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")  # active | resolved
    # Store exact coords internally; return approximate to clients
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_meters: Mapped[float] = mapped_column(Float, nullable=False, default=999.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="incidents")
    witness_alerts: Mapped[list["WitnessAlert"]] = relationship("WitnessAlert", back_populates="incident", lazy="select")
    evidence_items: Mapped[list["EvidenceItem"]] = relationship("EvidenceItem", back_populates="incident", lazy="select")


class WitnessAlert(Base):
    __tablename__ = "witness_alerts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(String(32), ForeignKey("incidents.id"), nullable=False, index=True)
    witness_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="alerted")
    # pending | alerted | acknowledged | revealed
    distance_meters: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    incident: Mapped["Incident"] = relationship("Incident", back_populates="witness_alerts")
    witness: Mapped["User"] = relationship("User", foreign_keys=[witness_id], back_populates="witness_alerts")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(String(32), ForeignKey("incidents.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # video | audio | photo
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    filename: Mapped[str] = mapped_column(String(260), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    anchored: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    upload_status: Mapped[str] = mapped_column(String(16), nullable=False, default="uploaded")
    # uploaded | failed | pending
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)

    incident: Mapped["Incident"] = relationship("Incident", back_populates="evidence_items")
    user: Mapped["User"] = relationship("User", back_populates="evidence_items")


class SafePlace(Base):
    __tablename__ = "safe_places"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # police | hospital | pharmacy | petrol | shelter
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    address: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    verification_level: Mapped[str] = mapped_column(String(20), nullable=False, default="unverified")
    # unverified | community | admin
    added_by: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False)
    channel: Mapped[str] = mapped_column(String(16), nullable=False, default="whatsapp")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class TripMonitor(Base):
    __tablename__ = "trip_monitors"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    destination_label: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active", index=True)
    expected_arrival_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    ping_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ping_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    incident_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("incidents.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    actor_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
