from datetime import datetime

from pydantic import BaseModel


class AdminIncidentOut(BaseModel):
    id: str
    display_id: str
    status: str
    user_display_name: str
    approx_lat: float
    approx_lng: float
    accuracy_meters: float
    witness_alert_count: int
    witness_ack_count: int
    evidence_count: int
    elapsed_seconds: int
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class AdminWitnessOut(BaseModel):
    id: str
    label: str  # "Witness A" — anonymised unless revealed
    status: str
    approx_distance_meters: int
    revealed: bool
    display_name: str | None  # only if revealed


class AdminEvidenceOut(BaseModel):
    id: str
    kind: str
    label: str
    size_bytes: int
    sha256_hash: str
    anchored: bool
    upload_status: str


class AdminAuditEventOut(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: str | None
    actor_label: str
    ip_address: str | None
    created_at: datetime


class AuditLogPage(BaseModel):
    events: list[AdminAuditEventOut]
    total: int
    offset: int
    limit: int


class AdminIncidentDetailOut(BaseModel):
    incident: AdminIncidentOut
    witnesses: list[AdminWitnessOut]
    evidence: list[AdminEvidenceOut]
    timeline: list[AdminAuditEventOut]


class AdminUserOut(BaseModel):
    id: str
    display_name: str
    role: str
    witness_opt_in: bool
    anonymous_by_default: bool
    has_push: bool
    incident_count: int
    created_at: datetime


class AdminUserListPage(BaseModel):
    users: list[AdminUserOut]
    total: int
    offset: int
    limit: int


class SystemMetricsOut(BaseModel):
    active_incidents: int
    total_incidents: int
    total_users: int
    total_evidence: int
    total_safe_places: int
    db_status: str
