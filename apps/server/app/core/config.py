from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ABHAYA_", env_file=".env", extra="ignore")

    app_name: str = "Abhaya Core API"
    debug: bool = False

    # JWT
    secret_key: str = "dev-secret-change-in-production-min32chars!!"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 h

    # DB
    database_url: str = "sqlite+aiosqlite:///./abhaya.db"

    # Storage
    evidence_upload_dir: str = "./uploads"
    max_evidence_size_bytes: int = 50 * 1024 * 1024  # 50 MB

    # Safety
    witness_alert_radius_meters: float = 500.0
    max_sos_per_hour: int = 3
    max_sos_location_age_minutes: int = 10
    max_sos_accuracy_meters: float = 5_000.0
    max_evidence_per_incident: int = 10
    max_trusted_contacts_per_user: int = 5

    # CORS
    cors_origins: list[str] | str = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


settings = Settings()
