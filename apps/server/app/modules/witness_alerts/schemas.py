from datetime import datetime

from pydantic import BaseModel


class WitnessAlertOut(BaseModel):
    id: str
    incident_id: str
    status: str
    # Approximate distance only — never exact location
    approx_distance_meters: int
    # Approx incident zone for map display (never exact)
    incident_approx_lat: float
    incident_approx_lng: float
    incident_created_at: datetime
    acknowledged_at: datetime | None
    revealed_at: datetime | None
    # Witness identity — only if revealed
    witness_display_name: str | None

    model_config = {"from_attributes": True}
