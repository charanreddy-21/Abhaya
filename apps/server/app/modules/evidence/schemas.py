from datetime import datetime

from pydantic import BaseModel, Field


class EvidenceOut(BaseModel):
    id: str
    incident_id: str
    kind: str
    label: str
    size_bytes: int
    sha256_hash: str
    anchored: bool
    upload_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EvidenceUploadMeta(BaseModel):
    """JSON metadata sent alongside the file upload."""
    incident_id: str
    kind: str = Field(pattern="^(video|audio|photo)$")
    label: str = Field(min_length=1, max_length=200)
    sha256_hash: str = Field(min_length=64, max_length=64, pattern="^[0-9a-f]{64}$")
