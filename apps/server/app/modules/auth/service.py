from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.config import settings
from apps.server.app.core.security import create_access_token, hash_password, verify_password
from apps.server.app.modules.auth.repository import UserRepository
from apps.server.app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from apps.server.app.shared.errors import email_taken, invalid_credentials
from apps.server.app.shared.models import User
from apps.server.app.shared.utils import rate_limiter


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self._repo = UserRepository(db)

    async def register(self, req: RegisterRequest) -> tuple[User, TokenResponse]:
        existing = await self._repo.get_by_email(req.email)
        if existing:
            raise email_taken()

        hashed = hash_password(req.password)
        user = await self._repo.create(req.email, hashed, req.display_name)
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
            raise invalid_credentials()

        token = create_access_token(user.id, user.role)
        return user, TokenResponse(
            access_token=token,
            expires_in=settings.access_token_expire_minutes * 60,
        )
