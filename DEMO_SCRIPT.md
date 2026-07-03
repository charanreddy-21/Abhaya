# Abhaya 3-Minute Demo Script

Use this script for a fast judge walkthrough. Keep the tone calm and honest: Abhaya helps coordinate safety signals, records, and witnesses. It does not guarantee safety, police dispatch, legal admissibility, or notification delivery.

## Prep

- Start backend: `npm run dev:server`
- Start web app: `npm run dev:web`
- Open: `http://localhost:3000`
- Demo accounts:
  - User: `demo@abhaya.in` / `demo1234`
  - Witness: `witness@abhaya.in` / `witness1234`
  - Admin: `admin@abhaya.in` / `admin1234`

The backend seeds demo users, safe places, trusted contacts, one active SOS, one resolved SOS, witness alerts, an active Safe Trip, evidence placeholders, and admin audit data on startup.

## 0:00-0:20 - Landing And Login

Screen: `/`

1. Show the Abhaya landing screen.
2. Say: "Abhaya is a public safety companion for India. The product promise is safety with reason: fast SOS, nearby opt-in witnesses, evidence integrity support, Safe Trip check-ins, and clear limits."
3. Click `Sign in to continue`.
4. On `/auth/login`, click the `User` demo account button or enter `demo@abhaya.in` / `demo1234`.
5. Sign in.

Feature shown: honest positioning, demo account entry, PWA shell.

## 0:20-0:45 - Home Dashboard

Screen: `/`

1. Show `Welcome, Demo`.
2. Point to the `SOS active` banner and the large `Emergency SOS` panel.
3. Point to `System > Server connected`.
4. Say: "The home screen is operational, not marketing. It shows active state, backend health, and quick access to the core safety workflows."
5. Use the quick links briefly: `SOS history`, `Witness alerts`, `Evidence`, `Safe places`, `Safe Trip`, `Contacts`.

Feature shown: authenticated dashboard, active incident awareness, backend status, quick navigation.

## 0:45-1:15 - SOS Active Incident

Screen: `/sos/active`

1. Click `SOS` in the left nav or the active SOS banner.
2. Show `SOS Active`, incident ID, elapsed timer, witness count, and evidence count.
3. Show the map area and say: "The map uses an approximate SOS area. We avoid exposing live responder locations."
4. Show `Incident status` chips: location accuracy, alerted witnesses, evidence items.
5. Show the `Nearby alerts` witness panel if visible.
6. Do not click `Mark Resolved` during the main demo unless you intentionally want to show the resolved state.

Feature shown: active SOS, approximate location, witness alert counts, evidence count, no overclaiming.

## 1:15-1:35 - Evidence And History

Screen: `/evidence`, then `/sos/history`

1. Click `Evidence`.
2. Show `Evidence vault` cards with `Demo evidence placeholder`, SHA-256 hash, anchored badge, and download/delete actions.
3. Say: "Evidence is represented with hash metadata and integrity support. This prototype does not claim legal admissibility."
4. Click `History`.
5. Show active and resolved incidents with witness and evidence counts.

Feature shown: evidence metadata, hash integrity support, incident history.

## 1:35-1:55 - Safe Places, Contacts, Safe Trip

Screen: `/safe-places`

1. Click `Safe Places`.
2. Show nearby public locations: police, hospital, pharmacy, petrol station, shelter.
3. Say: "Safe places are contextual support, not guaranteed safe routes."

Screen: `/contacts`

4. Click `Contacts`.
5. Show trusted contacts with masked phone numbers and WhatsApp/SMS badges.
6. Say: "Phone numbers stay masked in the UI."

Screen: `/trip`

7. Click `Safe Trip`.
8. Show the active trip to `Home via Koramangala Metro`, timer, `I arrived safely`, `Running late`, and `Cancel trip`.
9. Say: "Safe Trip is for daily travel anxiety: if a user misses check-in, Abhaya can start escalation steps and notify trusted contacts when configured."

Feature shown: safe-place directory, masked trusted contacts, active Safe Trip timer.

## 1:55-2:20 - Witness Mode

Screen: sign out, then `/auth/login`, then `/witness/alert`

1. Click `Sign out` in the left nav.
2. Sign in as `witness@abhaya.in` / `witness1234`.
3. Open `Witness`.
4. Show `Receive nearby alerts` is active.
5. Show the `SOS nearby` card, approximate distance, and map caption.
6. If the card is `Needs attention`, click `I see this alert`.
7. If the card is `Acknowledged`, show `Reveal my identity` but do not confirm unless asked.
8. Say: "Witness mode is opt-in. Identity and location stay hidden unless the witness chooses to reveal identity."

Feature shown: opt-in witness alerts, anonymous default, acknowledge/reveal controls.

## 2:20-2:55 - Admin Command Center

Screen: sign out, then `/auth/login`, then `/admin`

1. Click `Sign out`.
2. Sign in as `admin@abhaya.in` / `admin1234`.
3. Open `Admin`.
4. Show metrics: active incidents, total users, evidence items, safe places.
5. Show the incident table with status, user, elapsed time, alerts/acks, and evidence count.
6. Click the first incident row arrow.
7. On incident detail, show approximate location, witness list, captured evidence, and timeline.
8. Say: "Admin access is intentionally limited and audited. Raw evidence access should require explicit authorization."

Feature shown: command center, incident detail, evidence metadata, audit-minded admin flow.

## 2:55-3:00 - Close

Screen: `/admin` or incident detail

Say: "Abhaya is a modular monolith prototype: Next.js PWA, FastAPI backend, SQLite locally with a PostgreSQL/PostGIS direction. The demo shows end-to-end safety workflows without pretending software can guarantee real-world response."

## Backup Flow If Location Permission Fails

- Stay on seeded active SOS instead of creating a new SOS.
- Say: "The app handles denied or weak location with plain-language errors. For this timed demo, the seeded active incident lets us show the full workflow reliably."

## Backup Flow If The Backend Is Offline

- Show the home `System` panel or offline banner.
- Say: "Abhaya uses honest degraded states. SOS can be queued locally and retried when the network returns, but emergency services should be contacted directly for life-threatening emergencies."
