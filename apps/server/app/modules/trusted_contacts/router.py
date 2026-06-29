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

from apps.server.app.core.security import get_current_user
from .schemas import ContactCreate, ContactResponse, ContactUpdate
from .service import TrustedContactsService   # plain runtime import

router = APIRouter(prefix="/api/contacts", tags=["trusted-contacts"])


def _get_service(request: Request) -> TrustedContactsService:
    return request.app.state.trusted_contacts_service


@router.get("/", response_model=list[ContactResponse])
async def list_contacts(
    request: Request,
    user=Depends(get_current_user),
    service: TrustedContactsService = Depends(_get_service),
):
    return await service.list_contacts(user.id)


@router.post("/", response_model=ContactResponse, status_code=201)
async def add_contact(
    payload: ContactCreate,
    request: Request,
    user=Depends(get_current_user),
    service: TrustedContactsService = Depends(_get_service),
):
    return await service.add_contact(user.id, payload)


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    payload: ContactUpdate,
    request: Request,
    user=Depends(get_current_user),
    service: TrustedContactsService = Depends(_get_service),
):
    return await service.update_contact(contact_id, user.id, payload)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: str,
    request: Request,
    user=Depends(get_current_user),
    service: TrustedContactsService = Depends(_get_service),
):
    await service.delete_contact(contact_id, user.id)
