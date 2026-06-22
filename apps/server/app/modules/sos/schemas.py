from datetime import datetime

from pydantic import BaseModel, Field


class CreateSOSRequest(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    accuracy_meters: float = Field(ge=0.0, le=50_000.0, default=999.0)


class IncidentOut(BaseModel):
    id: str
    status: str
    # Approximate coordinates only — never exact
    approx_lat: float
    approx_lng: float
    accuracy_meters: float
    witness_alert_count: int
    evidence_count: int
    elapsed_seconds: int
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class IncidentListOut(BaseModel):
    incidents: list[IncidentOut]
    total: int
