from pydantic import BaseModel, field_validator
from datetime import datetime, timezone
from typing import Optional
from enum import Enum

class TripStatus(str, Enum):
    active = "active"
    pending_checkin = "pending_checkin"
    extended = "extended"
    resolved = "resolved"
    escalated = "escalated"
    cancelled = "cancelled"

class TripCreate(BaseModel):
    destination_label: str
    expected_arrival_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("destination_label")
    @classmethod
    def destination_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Destination label cannot be empty.")
        if len(v) > 120:
            raise ValueError("Destination label is too long.")
        return v

    @field_validator("expected_arrival_at")
    @classmethod
    def arrival_must_be_future(cls, v: datetime) -> datetime:
        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            raise ValueError("expected_arrival_at must include timezone info.")
        if v <= now:
            raise ValueError("Expected arrival time must be in the future.")
        delta_minutes = (v - now).total_seconds() / 60
        if delta_minutes > 24 * 60:
            raise ValueError("Trip duration cannot exceed 24 hours.")
        return v

class TripExtend(BaseModel):
    extend_minutes: int

    @field_validator("extend_minutes")
    @classmethod
    def valid_extension(cls, v: int) -> int:
        if v not in (5, 10, 15, 30, 60):
            raise ValueError("Extend minutes must be one of: 5, 10, 15, 30, 60.")
        return v

class TripCheckin(BaseModel):
    pass

class TripResponse(BaseModel):
    id: str
    user_id: str
    destination_label: str
    status: TripStatus
    expected_arrival_at: datetime
    ping_sent_at: Optional[datetime] = None
    ping_deadline_at: Optional[datetime] = None
    incident_id: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class TripListResponse(BaseModel):
    trips: list[TripResponse]
    total: int