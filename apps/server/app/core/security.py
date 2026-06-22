import time
import uuid

import bcrypt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from joserfc import jwt
from joserfc.jwk import OctKey
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.config import settings
from apps.server.app.core.database import get_db
from apps.server.app.shared.errors import (
    forbidden,
    not_authenticated,
    token_expired,
)

_key = OctKey.import_key(settings.secret_key.encode())
_bearer = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, role: str) -> str:
    now = int(time.time())
    claims = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + settings.access_token_expire_minutes * 60,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode({"alg": settings.algorithm}, claims, _key)


def _decode_token(token: str) -> dict:
    try:
        decoded = jwt.decode(token, _key)
        claims = decoded.claims
        if claims.get("exp", 0) < int(time.time()):
            raise token_expired()
        return claims
    except Exception as exc:
        if isinstance(exc, type(token_expired())):
            raise
        raise not_authenticated() from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    if not credentials:
        raise not_authenticated()
    claims = _decode_token(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise not_authenticated()

    from apps.server.app.modules.auth.repository import UserRepository
    user = await UserRepository(db).get_by_id(user_id)
    if not user:
        raise not_authenticated()
    return user


async def require_admin(user=Depends(get_current_user)):
    if user.role != "admin":
        raise forbidden("the admin area")
    return user
