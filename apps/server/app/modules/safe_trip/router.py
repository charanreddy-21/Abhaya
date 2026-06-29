"""
Safe Trip router.

Routes are thin — all logic lives in SafeTripService.

Endpoints:
  POST   /api/trips/          create a new trip
  GET    /api/trips/          list user's trips
  GET    /api/trips/active    get current active/pending trip
  GET    /api/trips/{id}      get trip detail
  POST   /api/trips/{id}/checkin
  POST   /api/trips/{id}/extend
  POST   /api/trips/{id}/cancel

Note: collection routes use "/" not "" — FastAPI requires a non-empty
path when a prefix is defined on the router.
"""

from fastapi import APIRouter, Depends, Request

from .schemas import TripCreate, TripExtend, TripResponse, TripListResponse
from .service import SafeTripService   # plain runtime import — no TYPE_CHECKING guard

router = APIRouter(prefix="/api/trips", tags=["safe-trip"])


def _get_service(request: Request) -> SafeTripService:
    return request.app.state.safe_trip_service


def _current_user_id(request: Request) -> str:
    user = getattr(request.state, "user", None)
    if user is None:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "AUTH_SESSION_EXPIRED",
                    "message": "Your session expired. Please sign in again.",
                    "details": {},
                    "request-id": "",
                }
            },
        )
    return user["id"]


@router.post("/", response_model=TripResponse, status_code=201)
async def create_trip(
    payload: TripCreate,
    request: Request,
    service: SafeTripService = Depends(_get_service),
):
    return await service.create_trip(user_id=_current_user_id(request), payload=payload)


@router.get("/", response_model=TripListResponse)
async def list_trips(
    request: Request,
    service: SafeTripService = Depends(_get_service),
):
    user_id = _current_user_id(request)
    trips = await service._repo.list_for_user(user_id)
    return TripListResponse(trips=[TripResponse(**t) for t in trips], total=len(trips))


# /active MUST be declared before /{trip_id} — FastAPI matches routes in order.
@router.get("/active", response_model=TripResponse | None)
async def get_active_trip(
    request: Request,
    service: SafeTripService = Depends(_get_service),
):
    user_id = _current_user_id(request)
    trip = await service._repo.get_active_for_user(user_id)
    return TripResponse(**trip) if trip else None


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: str,
    request: Request,
    service: SafeTripService = Depends(_get_service),
):
    return await service._get_owned_trip(trip_id, _current_user_id(request))


@router.post("/{trip_id}/checkin", response_model=TripResponse)
async def checkin(
    trip_id: str,
    request: Request,
    service: SafeTripService = Depends(_get_service),
):
    return await service.checkin(trip_id=trip_id, user_id=_current_user_id(request))


@router.post("/{trip_id}/extend", response_model=TripResponse)
async def extend_trip(
    trip_id: str,
    payload: TripExtend,
    request: Request,
    service: SafeTripService = Depends(_get_service),
):
    return await service.extend(
        trip_id=trip_id, user_id=_current_user_id(request), payload=payload
    )


@router.post("/{trip_id}/cancel", response_model=TripResponse)
async def cancel_trip(
    trip_id: str,
    request: Request,
    service: SafeTripService = Depends(_get_service),
):
    return await service.cancel(trip_id=trip_id, user_id=_current_user_id(request))