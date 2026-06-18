# Abhaya Design System

Abhaya should feel like a calm companion during a stressful moment: steady, legible, fast, and trustworthy. It can use emergency red, but it should not feel like a panic siren on every screen.

## Design Principles

- Calm first: reduce cognitive load during danger.
- Honest status: show what happened, what failed, and what the user can do next.
- Privacy visible: make anonymity, location sharing, and deletion controls clear.
- One primary action per emergency screen.
- Accessible under stress: large touch targets, clear contrast, minimal decoration.
- Operational depth: command center screens should scan like tools, not marketing pages.

## Visual Direction

Avoid generic AI-style gradients, especially blue-purple gradients. The product should use restrained surfaces, strong typography, and a small number of meaningful colors.

Recommended palette:

```text
Ink          #111827
Slate        #374151
Mist         #F4F7F5
Paper        #FFFFFF
Forest       #1F6F50
Safety Red   #E11D48
Signal Amber #F59E0B
Trust Teal   #0F766E
Soft Rose    #FFF1F2
Line         #D8E0DC
```

Dark theme:

```text
Night        #0D1412
Panel        #14201D
Raised       #1D2B27
Text         #EAF2EE
Muted        #A8B8B0
Forest       #2BA66F
Safety Red   #FB4567
Signal Amber #FBBF24
Line         #2F403A
```

Usage:

- Red: SOS, danger state, destructive actions.
- Forest: safe/connected/verified.
- Amber: degraded state, permission warning, retrying.
- Teal: neutral system activity.
- Mist/Paper: calm app surfaces.

Do not use red for every button. A screen full of red makes the actual emergency action less meaningful.

## Typography

Use a highly legible sans-serif stack:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Scale:

```text
Display: 40/48, weight 700
Page title: 28/36, weight 700
Section title: 20/28, weight 650
Body: 16/24, weight 400
Small: 14/20, weight 400
Micro: 12/16, weight 500
```

Rules:

- Do not use viewport-scaled font sizes.
- Keep letter spacing at `0`.
- Emergency state text should be short and concrete.
- Avoid dense paragraphs in active SOS screens.

## Layout

Mobile-first PWA:

- Bottom primary action area for SOS and active incident controls.
- Map or status panel should be visible immediately on safety screens.
- Touch targets minimum `44px`.
- Keep critical actions reachable with one thumb.

Desktop command center:

- Left navigation rail.
- Main incident table or map.
- Right-side detail panel for selected incident.
- Avoid cards inside cards.
- Use compact, scannable rows for admin workflows.

Spacing tokens:

```text
space-1: 4px
space-2: 8px
space-3: 12px
space-4: 16px
space-5: 24px
space-6: 32px
space-7: 48px
```

Radius:

```text
control: 8px
panel: 8px
modal: 12px
pill: 999px
```

Cards should be used for individual repeated items, modals, and focused tool panels only.

## Core Components

### `SOSPanel`

Primary emergency action surface.

States:

- `idle`: ready to start SOS
- `arming`: short confirmation window
- `active`: SOS running
- `retrying`: network degraded
- `resolved`: incident closed

Requirements:

- Large primary SOS button.
- Secondary cancel or resolve action must be visually quieter.
- Active state shows alert delivery, evidence capture, and location status.
- Must work with keyboard and screen readers.

### `IncidentStatus`

Shows the current incident state in plain language.

Examples:

- "SOS active. Nearby opted-in users are being alerted."
- "Location is imprecise. Alerts may be less accurate."
- "Recording permission was denied. SOS is still active."

### `ResponderMap`

Map-first view for incidents and safe places.

Rules:

- Do not show live witness/responder locations to the SOS sender.
- Use approximate zones where privacy requires it.
- Safe places should show verification status.
- Avoid decorative map effects that reduce clarity.

Recommended library:

- `maplibre-gl` with a React wrapper, or another lightweight map library if it fits deployment constraints.

### `WitnessAlert`

Alert screen for opted-in nearby users.

Content:

- Approximate incident area
- Time since SOS
- Distance band, not unnecessary precision
- Acknowledge button
- Reveal identity option as a separate explicit action

### `EvidenceRecorder`

Captures browser-supported evidence.

States:

- permission needed
- recording
- paused/stopped
- hashing
- encrypting
- uploading
- upload failed
- anchored

Never block SOS if recording fails.

### `EvidenceVault`

User-controlled evidence list.

Requirements:

- Show media kind, capture time, upload state, hash state, and deletion control.
- Explain that integrity support is not a legal guarantee.
- Deletion should require confirmation.

### `SafePlaceList`

Nearby public places with verification level.

Verification badges:

- Unverified
- Community confirmed
- Admin verified

Do not label unverified places as safe.

### `AdminIncidentTable`

Command center list view.

Columns:

- Status
- Created time
- Approximate area
- Witness alerts sent
- Acknowledgements
- Evidence count
- Last event

Use row density and strong filtering instead of large decorative cards.

## Interaction Patterns

Buttons:

- Primary: one per screen section.
- Destructive: red, requires confirmation where irreversible.
- Icon buttons: use lucide-react and accessible labels.
- Loading buttons must keep stable width.

Forms:

- Use inline validation.
- Use plain-language errors.
- Do not erase user input on failure.

Permissions:

- Ask only when needed.
- Explain why before the browser prompt.
- Provide fallback copy after denial.

Toasts:

- Use for non-critical updates only.
- Critical emergency state belongs in the main screen, not a temporary toast.

Modals:

- Use for confirmation and focused decisions.
- Must trap focus.
- Must close with Escape unless the action is safety-critical.

## Motion

Motion should be subtle and useful.

Recommended:

- 120ms hover/focus transitions
- 180ms panel entrance
- 240ms modal entrance
- Gentle pulse for active SOS only
- Reduced motion support via `prefers-reduced-motion`

Avoid:

- Looping decorative motion
- Large parallax
- Bouncy emergency controls
- Animations that delay SOS actions

Suggested library:

- `framer-motion` for state transitions and layout changes.

## Accessibility

Targets:

- WCAG 2.2 AA as the prototype goal
- Visible focus states
- Keyboard access for all controls
- Screen-reader labels for icon-only actions
- Contrast of at least 4.5:1 for normal text
- Reduced motion support

Emergency surfaces:

- Do not rely on color alone.
- Use text labels with status icons.
- Make primary actions large and stable.
- Keep error recovery obvious.

## Page Blueprints

### Home / Safety Surface

Primary content:

- Current readiness status
- SOS action
- Location permission status
- Witness opt-in status
- Recent incident shortcut

Layout:

- Mobile: status at top, SOS action in lower reachable zone.
- Desktop: status and map side by side.

### Active SOS

Primary content:

- Incident state
- Alert delivery status
- Evidence recording/upload state
- Location quality
- Cancel/resolve controls

Tone:

- Short sentences.
- No technical jargon.

### Witness Alert

Primary content:

- Approximate location
- Time since trigger
- Acknowledge action
- Reveal identity option
- Safety disclaimer

### Evidence Vault

Primary content:

- Evidence item list
- Upload/hash/anchor state
- Delete controls
- Integrity explanation

### Admin Command Center

Primary content:

- Active incidents
- Filters
- Map
- Timeline side panel
- Audit status

Tone:

- Operational and compact.

## Component Naming

Use domain names when the component carries product meaning:

- `SOSPanel`
- `IncidentTimeline`
- `EvidenceVault`
- `EvidenceRecorder`
- `ResponderMap`
- `WitnessAlert`
- `SafePlaceList`
- `PermissionCard`
- `AdminIncidentTable`

Use generic names only for primitives:

- `Button`
- `Input`
- `Dialog`
- `Tabs`
- `Badge`
- `Toast`
- `Switch`

## Implementation Stack

Recommended frontend libraries:

- Next.js App Router
- Tailwind CSS
- Radix UI or shadcn/ui primitives
- lucide-react icons
- Framer Motion for subtle transitions
- MapLibre for maps
- Zod for validation
- React Hook Form for forms

Performance targets:

- PWA shell usable on mid-range Android.
- Route JS budget: keep initial route under 150 KB gzip where possible.
- Avoid heavy charting and animation packages unless needed.
- Lazy-load maps and admin-only views.

## Copy Style

Use:

- "Nearby opted-in users are being alerted."
- "Your location looks imprecise."
- "Recording permission was denied. SOS is still active."
- "Evidence was saved, but integrity anchoring is pending."

Avoid:

- "You are safe now."
- "Police have been dispatched."
- "This evidence is legally guaranteed."
- "Witnesses are tracking you."

## Design Quality Bar

Before shipping a screen:

- Does it feel calm under stress?
- Is the primary action obvious?
- Are errors readable by a non-technical user?
- Is sensitive data hidden unless necessary?
- Does the layout work on mobile first?
- Does the screen avoid generic gradient-heavy styling?
- Can the screen be used with keyboard and screen reader?
