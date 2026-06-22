import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


_TRIVIAL_PASSWORDS = frozenset({
    "password", "12345678", "password1", "qwerty123", "iloveyou",
    "welcome1", "123456789", "abcdefgh", "letmein1", "sunshine1",
})


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.lower() in _TRIVIAL_PASSWORDS:
            raise ValueError("Please choose a stronger password.")
        has_letter = bool(re.search(r"[a-zA-Z]", v))
        has_digit  = bool(re.search(r"\d", v))
        if not (has_letter and has_digit):
            raise ValueError("Password must contain at least one letter and one number.")
        return v

    @field_validator("display_name")
    @classmethod
    def display_name_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Display name cannot be blank.")
        return stripped


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    witness_opt_in: bool
    anonymous_by_default: bool

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=100)
    witness_opt_in: bool | None = None
    anonymous_by_default: bool | None = None

    @field_validator("display_name")
    @classmethod
    def display_name_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        stripped = v.strip()
        if not stripped:
            raise ValueError("Display name cannot be blank.")
        return stripped

    @model_validator(mode="after")
    def at_least_one_field(self) -> "UpdateProfileRequest":
        if self.display_name is None and self.witness_opt_in is None and self.anonymous_by_default is None:
            raise ValueError("At least one field must be provided to update.")
        return self
