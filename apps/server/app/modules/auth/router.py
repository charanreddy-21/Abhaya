from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from apps.server.app.core.database import get_db
from apps.server.app.core.security import get_current_user
from apps.server.app.modules.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
)
from apps.server.app.modules.auth.service import AuthService
from apps.server.app.modules.auth.repository import UserRepository

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=dict, status_code=201)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    client_ip = request.client.host if request.client else "unknown"
    user, token = await svc.register(req, client_ip)
    return {"user": UserOut.model_validate(user), "token": token}


@router.post("/login", response_model=dict)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    client_ip = request.client.host if request.client else "unknown"
    user, token = await svc.login(req, client_ip)
    return {"user": UserOut.model_validate(user), "token": token}


@router.get("/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    req: UpdateProfileRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    updates = req.model_dump(exclude_none=True)
    updated = await repo.update(user, **updates)
    return UserOut.model_validate(updated)
