from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AbhayaError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


def _err(code: str, message: str, status: int = 400, details: dict | None = None) -> AbhayaError:
    return AbhayaError(code, message, status, details)


# Auth
def not_authenticated() -> AbhayaError:
    return _err("NOT_AUTHENTICATED", "You need to sign in to continue.", 401)

def invalid_credentials() -> AbhayaError:
    return _err("INVALID_CREDENTIALS", "Email or password is incorrect.", 401)

def email_taken() -> AbhayaError:
    return _err("EMAIL_TAKEN", "That email is already registered.", 409)

def token_expired() -> AbhayaError:
    return _err("TOKEN_EXPIRED", "Your session has expired. Please sign in again.", 401)

def forbidden(resource: str = "this resource") -> AbhayaError:
    return _err("FORBIDDEN", f"You do not have permission to access {resource}.", 403)

# SOS
def sos_not_found() -> AbhayaError:
    return _err("SOS_NOT_FOUND", "That incident was not found.", 404)

def sos_already_resolved() -> AbhayaError:
    return _err("SOS_ALREADY_RESOLVED", "This incident is already resolved.", 409)

def sos_rate_limit() -> AbhayaError:
    return _err("SOS_RATE_LIMITED", "You have created too many incidents recently. Please wait before starting another.", 429)

def sos_location_required() -> AbhayaError:
    return _err("SOS_LOCATION_REQUIRED", "We need your location to send nearby alerts.", 422)

def sos_location_stale() -> AbhayaError:
    return _err("SOS_LOCATION_STALE", "Your location is too old. Try again near an open area.", 422)

def sos_location_poor_accuracy() -> AbhayaError:
    return _err("SOS_LOCATION_POOR_ACCURACY", "Your location is too imprecise. Move near an open area and try again.", 422)

# Evidence
def evidence_not_found() -> AbhayaError:
    return _err("EVIDENCE_NOT_FOUND", "That evidence item was not found.", 404)

def evidence_too_large(max_mb: int = 50) -> AbhayaError:
    return _err("EVIDENCE_TOO_LARGE", f"Evidence files must be under {max_mb} MB.", 413)

def evidence_limit_reached() -> AbhayaError:
    return _err("EVIDENCE_LIMIT_REACHED", "This incident already has the maximum number of evidence items.", 409)

def evidence_hash_mismatch() -> AbhayaError:
    return _err("EVIDENCE_HASH_MISMATCH", "The file hash does not match the declared hash. The file may be corrupted.", 422)

def evidence_unsupported_type() -> AbhayaError:
    return _err("EVIDENCE_UNSUPPORTED_TYPE", "Evidence must be an audio, photo, or video file.", 422)

# Witness alerts
def witness_alert_not_found() -> AbhayaError:
    return _err("WITNESS_ALERT_NOT_FOUND", "That witness alert was not found.", 404)

def witness_not_opted_in() -> AbhayaError:
    return _err("WITNESS_NOT_OPTED_IN", "You have not opted in to witness alerts.", 403)

# Safe places
def safe_place_not_found() -> AbhayaError:
    return _err("SAFE_PLACE_NOT_FOUND", "That safe place was not found.", 404)

# Rate limiting (generic)
def rate_limit_exceeded(detail: str = "Too many requests. Please wait before trying again.") -> AbhayaError:
    return _err("RATE_LIMIT_EXCEEDED", detail, 429)

# Trusted contacts
def contact_not_found() -> AbhayaError:
    return _err("CONTACT_NOT_FOUND", "We could not find that contact.", 404)

def contacts_limit_reached(max_contacts: int) -> AbhayaError:
    return _err("CONTACTS_LIMIT_REACHED", f"You can have up to {max_contacts} trusted contacts.", 422)

def contact_already_exists() -> AbhayaError:
    return _err("CONTACT_ALREADY_EXISTS", "That phone number is already in your trusted contacts.", 409)

# Safe trip
def trip_not_found() -> AbhayaError:
    return _err("TRIP_NOT_FOUND", "We could not find that trip.", 404)

def trip_already_active(existing_trip_id: str) -> AbhayaError:
    return _err(
        "TRIP_ALREADY_ACTIVE",
        "You already have an active Safe Trip. Check in or cancel it first.",
        409,
        {"existing_trip_id": existing_trip_id},
    )

def trip_already_terminal(status: str) -> AbhayaError:
    return _err("TRIP_ALREADY_TERMINAL", "This trip has already ended.", 409, {"status": status})

def trip_escalated_cannot_cancel(incident_id: str | None) -> AbhayaError:
    return _err(
        "TRIP_ESCALATED_CANNOT_CANCEL",
        "A safety alert is active. Use the SOS screen to resolve it.",
        409,
        {"incident_id": incident_id},
    )

# Generic
def bad_request(code: str, message: str) -> AbhayaError:
    return _err(code, message, 400)

def not_found(resource: str = "Resource") -> AbhayaError:
    return _err("NOT_FOUND", f"{resource} was not found.", 404)

def server_error(detail: str = "") -> AbhayaError:
    return _err("INTERNAL_ERROR", "Something went wrong. Please try again.", 500, {"detail": detail})


async def abhaya_error_handler(request: Request, exc: AbhayaError) -> JSONResponse:
    import uuid
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": request_id,
                "request-id": request_id,
            }
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    import uuid
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    if isinstance(exc.detail, dict) and isinstance(exc.detail.get("error"), dict):
        error = exc.detail["error"]
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": error.get("code", "HTTP_ERROR"),
                    "message": error.get("message", "Something went wrong. Please try again."),
                    "details": error.get("details", {}),
                    "request_id": error.get("request_id") or error.get("request-id") or request_id,
                    "request-id": error.get("request-id") or error.get("request_id") or request_id,
                }
            },
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "HTTP_ERROR",
                "message": str(exc.detail),
                "details": {},
                "request_id": request_id,
                "request-id": request_id,
            }
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    import uuid
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    fields = [
        {
            "field": ".".join(str(part) for part in error.get("loc", []) if part != "body"),
            "message": error.get("msg", "Invalid value."),
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Check the highlighted details and try again.",
                "details": {"fields": fields},
                "request_id": request_id,
                "request-id": request_id,
            }
        },
    )
