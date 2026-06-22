from pydantic import BaseModel, Field


class SafePlaceOut(BaseModel):
    id: str
    name: str
    kind: str
    lat: float
    lng: float
    address: str
    is_open: bool
    verification_level: str
    distance_meters: int | None = None

    model_config = {"from_attributes": True}


class CreateSafePlaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kind: str = Field(pattern="^(police|hospital|pharmacy|petrol|shelter)$")
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    address: str = Field(max_length=400, default="")
    is_open: bool = True
