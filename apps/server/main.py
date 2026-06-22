"""Abhaya FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware

from apps.server.app.core.config import settings
from apps.server.app.core.database import init_db
from apps.server.app.modules.admin.router import router as admin_router
from apps.server.app.modules.auth.router import router as auth_router
from apps.server.app.modules.evidence.router import router as evidence_router
from apps.server.app.modules.notifications.router import router as notifications_router
from apps.server.app.modules.safe_places.router import router as safe_places_router
from apps.server.app.modules.sos.router import router as sos_router
from apps.server.app.modules.witness_alerts.router import router as witness_router
from apps.server.app.shared.errors import AbhayaError, abhaya_error_handler, http_exception_handler


@asynccontextmanager
async def lifespan(application: FastAPI):
    await init_db()
    await _seed_if_empty()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AbhayaError, abhaya_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)

app.include_router(auth_router)
app.include_router(sos_router)
app.include_router(witness_router)
app.include_router(evidence_router)
app.include_router(safe_places_router)
app.include_router(admin_router)
app.include_router(notifications_router)


# ── Health ─────────────────────────────────────────────────────────────────────

from pydantic import BaseModel


class SystemStatus(BaseModel):
    status: int
    service: str
    spatial_engine: bool
    version: str


@app.get("/api/health", response_model=SystemStatus)
async def health_check():
    return SystemStatus(
        status=200,
        service="Abhaya Core API - operational",
        spatial_engine=True,
        version="0.2.0",
    )


# ── Seed ───────────────────────────────────────────────────────────────────────

async def _seed_if_empty() -> None:
    """Populate demo data on first run so the UI has something to show."""
    from apps.server.app.core.database import SessionLocal
    from apps.server.app.core.security import hash_password
    from apps.server.app.modules.safe_places.repository import SafePlaceRepository
    from apps.server.app.modules.auth.repository import UserRepository
    from apps.server.app.shared.models import SafePlace

    async with SessionLocal() as db:
        place_repo = SafePlaceRepository(db)
        if await place_repo.count() > 0:
            return  # already seeded

        # Demo users
        user_repo = UserRepository(db)

        demo_user = await user_repo.get_by_email("demo@abhaya.in")
        if not demo_user:
            demo_user = await user_repo.create(
                email="demo@abhaya.in",
                hashed_password=hash_password("demo1234"),
                display_name="Demo User",
                role="user",
            )
            demo_user = await user_repo.update(demo_user, witness_opt_in=True)

        demo_admin = await user_repo.get_by_email("admin@abhaya.in")
        if not demo_admin:
            demo_admin = await user_repo.create(
                email="admin@abhaya.in",
                hashed_password=hash_password("admin1234"),
                display_name="Admin User",
                role="admin",
            )

        # Witness user (will receive alerts)
        witness_user = await user_repo.get_by_email("witness@abhaya.in")
        if not witness_user:
            witness_user = await user_repo.create(
                email="witness@abhaya.in",
                hashed_password=hash_password("witness1234"),
                display_name="Priya Sharma",
                role="user",
            )
            witness_user = await user_repo.update(witness_user, witness_opt_in=True)

        # Safe places around Koramangala, Bengaluru
        seed_places = [
            dict(name="Koramangala Police Station", kind="police", lat=12.9352, lng=77.6245,
                 address="80 Feet Road, Koramangala 4th Block, Bengaluru 560034",
                 is_open=True, verification_level="admin"),
            dict(name="Manipal Hospital HSR", kind="hospital", lat=12.9116, lng=77.6389,
                 address="7 Outer Ring Road, HSR Layout, Bengaluru 560102",
                 is_open=True, verification_level="admin"),
            dict(name="Apollo Pharmacy Koramangala", kind="pharmacy", lat=12.9342, lng=77.6255,
                 address="2nd Main Rd, Koramangala 5th Block, Bengaluru 560095",
                 is_open=True, verification_level="community"),
            dict(name="BPCL Petrol Station", kind="petrol", lat=12.9281, lng=77.6320,
                 address="Sarjapur Road, Koramangala, Bengaluru 560095",
                 is_open=True, verification_level="community"),
            dict(name="Forum Mall Security Post", kind="shelter", lat=12.9323, lng=77.6235,
                 address="Hosur Rd, Koramangala, Bengaluru 560095",
                 is_open=False, verification_level="community"),
            dict(name="Indiranagar Police Station", kind="police", lat=12.9784, lng=77.6408,
                 address="100 Feet Road, Indiranagar, Bengaluru 560038",
                 is_open=True, verification_level="admin"),
            dict(name="Jayadeva Hospital", kind="hospital", lat=12.9201, lng=77.5968,
                 address="Bannerghatta Road, Jayanagar, Bengaluru 560041",
                 is_open=True, verification_level="admin"),
        ]

        for p in seed_places:
            vl = p.pop("verification_level")
            place = SafePlace(**p, added_by=demo_admin.id, verification_level=vl)
            db.add(place)
        await db.commit()
