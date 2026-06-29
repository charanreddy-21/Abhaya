from pydantic import BaseModel, field_validator
from typing import Optional
from enum import Enum
import re

PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


class ContactChannel(str, Enum):
    sms = "sms"
    whatsapp = "whatsapp"


class ContactCreate(BaseModel):
    name: str
    phone_number: str
    channel: ContactChannel = ContactChannel.whatsapp

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty.")
        if len(v) > 80:
            raise ValueError("Name is too long.")
        return v

    @field_validator("phone_number")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        v = v.strip().replace(" ", "").replace("-", "")
        if not PHONE_RE.match(v):
            raise ValueError(
                "Enter a valid phone number including country code, e.g. +919876543210."
            )
        return v


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    channel: Optional[ContactChannel] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Name cannot be empty.")
        return v

    @field_validator("phone_number")
    @classmethod
    def valid_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().replace(" ", "").replace("-", "")
            if not PHONE_RE.match(v):
                raise ValueError("Enter a valid phone number.")
        return v


class ContactResponse(BaseModel):
    id: str
    user_id: str
    name: str
    phone_number_masked: str   # e.g. "+91 ••••••7890"
    channel: ContactChannel
    created_at: str

    model_config = {"from_attributes": True}


class EchoDispatchResult(BaseModel):
    contact_id: str
    contact_name: str
    channel: ContactChannel
    delivered: bool
    error: Optional[str] = None