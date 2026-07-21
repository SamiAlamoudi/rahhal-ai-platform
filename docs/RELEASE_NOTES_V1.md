# Release Notes — Rahhal 1.0.0 General Availability

**Release:** `1.0.0`  
**Release type:** GA (+ post-GA library engines through Sprint 73)  
**Package version:** `1.1.0-rc.1`  
**Main tip:** Sprint 73 — Hotel Search Engine  
**QA:** Sprint QA-0 product audit (`docs/QA0_PRODUCT_AUDIT.md`)

## Highlights

- Production hardening (Sprint 65)
- End-to-end production validation (Sprint 66)
- Beta launch environment & live provider activation (Sprint 67)
- Production deployment & launch automation (Sprint 68)
- Real beta operations & production monitoring (Sprint 69)
- GA release manager & version manifest (Sprint 70)
- Provider Runtime framework (Sprint 71)
- Flight Search Engine (Sprint 72)
- Hotel Search Engine (Sprint 73)

## Safe defaults

- Mock payments
- Live providers OFF
- No architecture or business-engine rewrites in GA packaging

## Traveler path (current)

Production `/chat` uses Conversation Agent → Aggregation tools → Booking Intelligence → Booking Execution → mock Payments.  
Sprint 72/73 search engines are **library-ready** (verified via `flights:verify` / `hotels:verify`) and are **not yet** the default chat search path.

## Canonical docs

- `docs/CHANGELOG_V1.md`, `docs/SYSTEM_STATUS.md`, `docs/API_STATUS.md`
- `docs/SPRINT71_PROVIDER_RUNTIME.md` … `docs/SPRINT73_HOTEL_SEARCH_ENGINE.md`
- `docs/QA0_PRODUCT_AUDIT.md`

Root `RELEASE_NOTES.md` / `RELEASE_NOTES_v1.md` are historical pointers only.
