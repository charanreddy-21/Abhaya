import json

from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.config import settings
from apps.server.app.core.security import create_access_token, hash_password, verify_password
from apps.server.app.modules.auth.repository import UserRepository
from apps.server.app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from apps.server.app.shared.errors import email_taken, invalid_credentials
from apps.server.app.shared.models import AuditEvent, User
from apps.server.app.shared.utils import rate_limiter


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._repo = UserRepository(db)

    async def register(self, req: RegisterRequest, client_ip: str = "unknown") -> tuple[User, TokenResponse]:
        existing = await self._repo.get_by_email(req.email)
        if existing:
            raise email_taken()

        hashed = hash_password(req.password)
        user = await self._repo.create(req.email, hashed, req.display_name)

        audit = AuditEvent(
            actor_id=user.id,
            action="auth.register",
            resource_type="user",
            resource_id=user.id,
            ip_address=client_ip,
            metadata_json=json.dumps({"email_domain": req.email.split("@")[1]}),
        )
        self._db.add(audit)
        await self._db.commit()

        token = create_access_token(user.id, user.role)
        return user, TokenResponse(
            access_token=token,
            expires_in=settings.access_token_expire_minutes * 60,
        )

    async def login(self, req: LoginRequest, client_ip: str = "unknown") -> tuple[User, TokenResponse]:
        if not rate_limiter.is_allowed(f"auth:{client_ip}", limit=10, window_seconds=60):
            raise invalid_credentials()  # don't reveal rate limit on auth endpoint

        user = await self._repo.get_by_email(req.email)
        if not user or not verify_password(req.password, user.hashed_password):
            # Audit failed login (without exposing why it failed)
            await self._log_auth_event(None, "auth.login.failed", client_ip, {"attempted_email": req.email[:3] + "***"})
            raise invalid_credentials()

        await self._log_auth_event(user.id, "auth.login", client_ip, {})

        token = create_access_token(user.id, user.role)
        return user, TokenResponse(
            access_token=token,
            expires_in=settings.access_token_expire_minutes * 60,
        )

    async def _log_auth_event(
        self,
        user_id: str | None,
        action: str,
        client_ip: str,
        metadata: dict,
    ) -> None:
        event = AuditEvent(
            actor_id=user_id,
            action=action,
            resource_type="session",
            resource_id=None,
            ip_address=client_ip,
            metadata_json=json.dumps(metadata),
        )
        self._db.add(event)
        await self._db.commit()
