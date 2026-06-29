"""
Trusted Contacts router.

Endpoints:
  GET    /api/contacts/         list contacts
  POST   /api/contacts/         add a contact
  PATCH  /api/contacts/{id}     update a contact
  DELETE /api/contacts/{id}     remove a contact

Collection routes use "/" not "" — FastAPI requires a non-empty
path when a prefix is defined on the router.
"""

from fastapi import APIRouter, Depends, Request

from .schemas import ContactCreate, ContactResponse, ContactUpdate
from .service import TrustedContactsService   # plain runtime import

router = APIRouter(prefix="/api/contacts", tags=["trusted-contacts"])


def _get_service(request: Request) -> TrustedContactsService:
    return request.app.state.trusted_contacts_service


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


@router.get("/", response_model=list[ContactResponse])
async def list_contacts(
    request: Request,
    service: TrustedContactsService = Depends(_get_service),
):
    return await service.list_contacts(_current_user_id(request))


@router.post("/", response_model=ContactResponse, status_code=201)
async def add_contact(
    payload: ContactCreate,
    request: Request,
    service: TrustedContactsService = Depends(_get_service),
):
    return await service.add_contact(_current_user_id(request), payload)


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    payload: ContactUpdate,
    request: Request,
    service: TrustedContactsService = Depends(_get_service),
):
    return await service.update_contact(contact_id, _current_user_id(request), payload)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: str,
    request: Request,
    service: TrustedContactsService = Depends(_get_service),
):
    await service.delete_contact(contact_id, _current_user_id(request))