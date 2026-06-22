# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Abhaya is a hackathon prototype for a PWA-first public safety platform for India. The product promise is **safety with reason** — it helps users trigger SOS, alert nearby opted-in witnesses, preserve incident evidence, and show honest plain-language guidance when things fail. This is a safety-critical, privacy-sensitive product. Do not overclaim safety, police dispatch, legal admissibility, or guaranteed routing.

## Commands

### Backend

```bash
# Create and activate virtual environment (first time)
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r apps/server/requirements.txt

# Run dev server (from repo root, requires venv active)
npm run dev:server
# -> http://localhost:8000  |  health: http://localhost:8000/api/health
```

### Frontend

```bash
# From repo root
npm install
npm run dev:web
# -> http://localhost:3000

# Or from apps/web directly
cd apps/web && npm install && npm run dev
```

### Both together

Run `npm run dev:server` and `npm run dev:web` in separate terminals.

## Architecture

### Monorepo layout

```
apps/server/       FastAPI backend (Python)
apps/web/          Next.js 14 App Router PWA (TypeScript)
```

Root `package.json` uses npm workspaces (`apps/web` only; Python is not a workspace). Scripts proxy to `apps/web` via `scripts/run-web.mjs`.

### Backend — FastAPI modular monolith

`apps/server/main.py` is the current entry point. The intended shape as modules are added:

```
apps/server/app/
  api/          FastAPI routers (thin — no business logic)
  core/         config, db, middleware
  modules/
    auth/
    sos/
    evidence/
    witness_alerts/
    safe_places/
    notifications/
    admin/
    audit/
  shared/       base models, errors, utils
```

Each module owns its own router, service, repository, and Pydantic schemas. Business rules live in services; database access lives in repositories.

Infrastructure targets: PostgreSQL + PostGIS, Redis (live incident state + rate limits), S3-compatible storage (encrypted evidence blobs), IPFS/OpenTimestamps-style hash anchoring.

### Frontend — Next.js App Router

`apps/web/src/` layout:

```
app/              Next.js pages and layouts
components/
  ui/             Generic primitives (Button, Input, Badge, Dialog…)
  domain/         Product components (SOSPanel, EvidenceVault, ResponderMap…)
  brand/          Logo/glyph assets
features/         Feature-level logic (not yet populated)
lib/              Shared utilities
styles/           Global CSS (globals.css with CSS custom properties)
types/            Shared TypeScript types
```

Use **Server Components by default**; switch to Client Components only for interaction, browser APIs, sensors, maps, or realtime state.

### CSS tokens

Colors and spacing are defined as CSS custom properties in `globals.css` (not Tailwind config values). Use the variable names (`--ink`, `--forest`, `--red`, `--amber`, etc.) rather than raw hex. Dark mode is handled via `@media (prefers-color-scheme: dark)`.

Key semantic assignments:
- `--red` / `--red-soft`: SOS, danger, destructive actions
- `--forest` / `--forest-soft`: safe/connected/verified
- `--amber` / `--amber-soft`: degraded state, permission warnings
- `--teal` / `--teal-soft`: neutral system activity

## Coding Standards

### Python

- Strict Pydantic v2 models for all FastAPI inputs and outputs
- `snake_case` for all variables, fields, and filenames
- Error codes in `UPPER_SNAKE_CASE`

### TypeScript / React

- Strict TypeScript — no `any`, no untyped API responses
- `camelCase` for variables and functions; `PascalCase` for components
- `kebab-case.tsx` for component filenames
- Zod for validation; React Hook Form for forms (when added)

### API conventions

- Resource-oriented paths under `/api`
- Standard error shape:
  ```json
  { "error": { "code": "SOS_LOCATION_REQUIRED", "message": "...", "details": {}, "request-id": "req_123" } }
  ```
- User-facing messages must be calm, short, and actionable — no stack traces or storage keys

## Safety and Privacy Rules

These are non-negotiable, not optional guidelines:

- Never expose live witness/responder locations to an SOS sender
- Never reveal witness identity unless the witness explicitly opts in
- Store location temporarily only — no permanent location history
- Witness proximity alerts are opt-in, default off
- Rate-limit SOS creation, witness alerts, evidence uploads, and auth endpoints
- Audit-log all admin access to sensitive incident or evidence data
- Minimize sensitive fields in API responses (least-privilege return shapes)
- Treat exact location, incident history, evidence media, evidence hashes, email addresses, push endpoints, and session data as sensitive

## Robustness

Every user-facing workflow must handle and show plain-language copy for: backend offline, weak network, location denied, poor GPS accuracy, camera/mic denied, push unsupported, evidence upload failure, duplicate SOS submissions, and expired sessions.

Never block SOS because evidence recording or upload failed — evidence capture is supplementary.

## Design Principles

- Calm companion, not a panic dashboard
- One primary action per emergency screen
- Mobile-first PWA: bottom action zone, 44px minimum touch targets
- Never use red for non-emergency UI; a page full of red makes SOS feel less urgent
- Avoid blue-purple gradients
- WCAG 2.2 AA accessibility target; visible focus states; reduced motion support
- `prefers-reduced-motion` must suppress all non-essential animation

## Review Checklist

Before marking any change complete:

- Does it overclaim safety or legality?
- Does it leak sensitive data to the wrong party?
- Does it handle denied permissions gracefully?
- Does user-facing copy stay calm and non-technical?
- Is business logic in services, not route handlers or React components?
- Does it match the design token system?
- Does it preserve the modular monolith shape?
