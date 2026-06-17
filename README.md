
# Abhaya: Next-Generation Women's Safety Infrastructure

Abhaya is a full-stack, monorepo-based application designed to provide real-time, mathematically verifiable, and agentic safety infrastructure. Built with a Next.js frontend and a FastAPI backend, it prioritizes immediate localized response and legal evidence integrity.

## Core Features

* **Dynamic Escape Route & Temporal Safety Intelligence:** Computes real-time safe routing by actively avoiding dynamically generated "Red Zones" based on temporal risk data and directing users to verified safe havens (pharmacies, petrol stations).
* **Proximity Witness Network:** Utilizes spatial database indexing to instantly alert Abhaya users within a 300-meter radius of an SOS event.
* **Legal Evidence Chain of Custody:** Captures emergency audio/video, encrypts it on the client device, and generates a SHA-256 hash. This hash is anchored to an immutable ledger (IPFS/OpenTimestamps) to guarantee admissibility for FIR filing.
* **Multilingual Stealth Voice & Shake Trigger:** Hardware-accelerated shake detection and discreet voice triggers bypass the need for screen interaction, dispatching localized alerts in the responder's native language.
* **Agentic Emergency Coordinator:** An autonomous background process that tracks SOS acknowledgments, manages live status feeds, and escalates to secondary emergency contacts if local responders do not engage.

## High-Level Design (HLD)

### Architecture Stack
* **Frontend (`apps/web`):** Next.js (React), TypeScript, TailwindCSS. Handles sensor polling, local cryptography, and real-time mapping UI.
* **Backend (`apps/server`):** FastAPI (Python), Uvicorn. Manages concurrent spatial queries, JWT authentication, and agentic workflows.
* **Database (Planned):** PostgreSQL with PostGIS extensions for rapid geolocation radius querying.

### System Flow
```text
[Client Device]
   ├── Hardware Sensors (Accelerometer / Mic)
   ├── Local Crypto Engine (SHA-256 / AES)
   └── WebSockets (Real-time tracking)
         │
    (Encrypted Data & Spatial Coordinates)
         │
         ▼
[FastAPI API Gateway]
   ├── Spatial Query Engine -> (Find users within 300m)
   ├── Multilingual Localization Service
   ├── Agentic Escalation Loop -> (Track read-receipts & response status)
   └── Evidence Anchoring Service -> (Submit Hash to IPFS)
         │
         ▼
[Persistence Layer]
   ├── PostgreSQL/PostGIS (User states, Map Hexbins)
   └── S3 / Cloud Storage (Encrypted Video Blobs)
