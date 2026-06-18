# AGENTS.md

This file guides contributors and coding agents working on Abhaya. Keep changes practical: this is a hackathon prototype, but the domain is safety-critical, privacy-sensitive, and easy to overclaim.

## Product Truth

- Product name: Abhaya.
- Target region: India.
- Product mode: hackathon prototype.
- Primary audience: general public, with women as the main safety persona.
- Voice: calm, direct, and honest.
- Core promise: safety with reason.

Do not claim Abhaya guarantees safety, police dispatch, legal admissibility, or perfect routing. Use careful phrasing such as "helps", "supports", "alerts", "records", and "integrity support".

## Architecture Direction

Use a modular monolith.

```text
Next.js PWA
  -> FastAPI modular monolith
    -> PostgreSQL + PostGIS
    -> Redis for live incident state and rate limits
    -> S3-compatible encrypted evidence storage
    -> IPFS/OpenTimestamps-style hash anchoring when available
```

Primary backend modules:

- `auth`
- `sos`
- `witness-alerts`
- `evidence`
- `safe-places`
- `notifications`
- `admin-command-center`
- `audit`

Backend code should evolve toward this shape:

```text
apps/server/
+-- main.py
+-- app/
|   +-- api/
|   +-- core/
|   +-- modules/
|   |   +-- auth/
|   |   +-- sos/
|   |   +-- evidence/
|   |   +-- witness_alerts/
|   +-- shared/
```

Frontend code should evolve toward this shape:

```text
apps/web/src/
+-- app/
+-- components/
|   +-- domain/
|   +-- ui/
+-- features/
+-- lib/
+-- styles/
+-- types/
```

## Coding Standards

- Use strict TypeScript.
- Use typed Pydantic models for FastAPI inputs and outputs.
- Keep route handlers thin.
- Put business rules in services.
- Put database access behind repositories.
- Keep reusable frontend primitives in `components/ui`.
- Keep domain components in `components/domain` or feature folders.
- Prefer explicit names over clever names.
- Use plain-language user-facing errors.
- Keep technical details in logs, not UI.

Naming:

- Python variables and fields: `snake_case`
- TypeScript variables and functions: `camelCase`
- React components: `PascalCase`
- Files for React components: `kebab-case.tsx` unless a local convention says otherwise
- API external payloads: dash-case only if explicitly mapped; otherwise prefer idiomatic internal naming
- Error codes: `UPPER_SNAKE_CASE`

## Safety And Privacy Rules

- Never add surveillance-like features.
- Do not expose live responder locations to an SOS sender.
- Do not expose witness identity unless the witness chooses to reveal it.
- Store location temporarily by default.
- Keep witness alerts opt-in.
- Add rate limits around SOS, witness alerts, uploads, and auth.
- Add audit events for admin access to sensitive incident or evidence data.
- Minimize sensitive fields returned from APIs.
- Use least-privilege access patterns.

Sensitive data includes:

- Exact location
- Incident history
- Evidence media
- Evidence hashes and storage metadata
- Email addresses
- Admin actions
- Push subscription endpoints
- Authentication/session data

## Robustness Requirements

Every user-facing workflow must handle:

- Backend offline
- Weak network
- Location denied
- Poor GPS accuracy
- Camera or microphone denied
- Push notifications unsupported
- Evidence upload failure
- Duplicate or repeated SOS submissions
- Expired sessions

Preferred API error format:

```json
{
  "error": {
    "code": "SOS_LOCATION_REQUIRED",
    "message": "We need your location to send nearby alerts.",
    "details": {},
    "request-id": "req_123"
  }
}
```

Rules:

- User message must be calm and actionable.
- Error code must be stable.
- `details` must not leak secrets.
- Server logs may contain deeper diagnostics with a request ID.

## Frontend Rules

Follow `DESIGN_SYSTEM.md`.

Key points:

- Build a calm companion, not a panic dashboard.
- Adaptive light/dark theme.
- Avoid blue-purple gradients.
- Use red sparingly and intentionally for emergency state.
- Use lucide-react icons for recognizable actions.
- Use Radix UI or shadcn/ui patterns where accessibility matters.
- Use Framer Motion for subtle transitions only.
- Use map UI as a primary surface for incident and safe-place context.
- Do not add marketing hero pages unless explicitly requested.

Expected domain components:

- `SOSPanel`
- `IncidentStatus`
- `ResponderMap`
- `WitnessAlert`
- `EvidenceVault`
- `EvidenceRecorder`
- `SafePlaceList`
- `IncidentTimeline`
- `PermissionCard`
- `AdminIncidentTable`

## Documentation Rules

When adding a feature, update docs if the mental model changes.

Update `README.md` for:

- Setup changes
- New environment variables
- New major modules
- New API routes
- New roadmap status

Update `DESIGN_SYSTEM.md` for:

- New UI primitives
- New colors or tokens
- New animation patterns
- New page layouts

Do not turn the docs into fiction. Planned features are allowed, but label them clearly.

## Library Guidance

Libraries are allowed when they make the prototype more reliable or more polished.

Good candidates:

- `lucide-react` for icons
- `@radix-ui/*` or shadcn/ui for accessible primitives
- `framer-motion` for subtle transitions
- `maplibre-gl` or a React map wrapper for maps
- `zod` for frontend validation
- `react-hook-form` for forms
- Web Crypto APIs for hashing and encryption where possible

Avoid adding heavy libraries for simple utilities.

## Review Checklist

Before finishing a change, check:

- Does this overclaim safety or legality?
- Does it leak sensitive data?
- Does it handle denied permissions?
- Does it show a plain-language error?
- Does it keep business logic out of UI and route handlers?
- Does it match the design system?
- Does it preserve the modular monolith direction?
