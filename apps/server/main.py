"""Abhaya FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from apps.server.app.core.config import settings
from apps.server.app.core.database import init_db, SessionLocal
from apps.server.app.modules.admin.router import router as admin_router
from apps.server.app.modules.auth.router import router as auth_router
from apps.server.app.modules.evidence.router import router as evidence_router
from apps.server.app.modules.notifications.router import router as notifications_router
from apps.server.app.modules.safe_places.router import router as safe_places_router
from apps.server.app.modules.sos.router import router as sos_router
from apps.server.app.modules.witness_alerts.router import router as witness_router
from apps.server.app.shared.errors import (
    AbhayaError,
    abhaya_error_handler,
    http_exception_handler,
    validation_exception_handler,
)
from apps.server.app.modules.safe_trip.router import router as trip_router
from apps.server.app.modules.trusted_contacts.router import router as contacts_router


@asynccontextmanager
async def lifespan(application: FastAPI):
    await init_db()

    # Wire services into app.state once at startup.
    # Repositories receive a session_factory, NOT an open session,
    # so each repo method opens its own connection per request.
    from apps.server.app.modules.safe_trip.service import SafeTripService
    from apps.server.app.modules.safe_trip.service import SafeTripSOSAdapter
    from apps.server.app.modules.safe_trip.repository import SafeTripRepository
    from apps.server.app.modules.trusted_contacts.service import TrustedContactsService
    from apps.server.app.modules.trusted_contacts.repository import TrustedContactsRepository

    application.state.trusted_contacts_service = TrustedContactsService(
        repo=TrustedContactsRepository(session_factory=SessionLocal),
    )
    application.state.safe_trip_service = SafeTripService(
        repo=SafeTripRepository(session_factory=SessionLocal),
        sos_service=SafeTripSOSAdapter(SessionLocal),
        echo_service=application.state.trusted_contacts_service,
    )

    scheduler_task = asyncio.create_task(_safe_trip_scheduler(application))

    await _seed_demo_data()
    try:
        yield
    finally:
        scheduler_task.cancel()
        with suppress(asyncio.CancelledError):
            await scheduler_task


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
app.add_exception_handler(RequestValidationError, validation_exception_handler)

app.include_router(auth_router)
app.include_router(sos_router)
app.include_router(witness_router)
app.include_router(evidence_router)
app.include_router(safe_places_router)
app.include_router(admin_router)
app.include_router(notifications_router)
# Routers already define their own prefix — do NOT pass prefix= here.
app.include_router(trip_router)
app.include_router(contacts_router)


async def _safe_trip_scheduler(application: FastAPI) -> None:
    """Small prototype scheduler for Safe Trip ping/escalation transitions."""
    while True:
        await asyncio.sleep(30)
        try:
            service = application.state.safe_trip_service
            await service.check_due_pings()
            await service.check_due_escalations()
        except Exception:
            import logging
            logging.getLogger(__name__).exception("safe_trip_scheduler_failed")


# ── Health ──────────────────────────────────────────────────────────────────

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


# ── Seed ────────────────────────────────────────────────────────────────────

async def _seed_demo_data() -> None:
    """Populate a complete, idempotent demo baseline."""
    from apps.server.app.demo_seed import seed_demo_data

    async with SessionLocal() as db:
        await seed_demo_data(db)
