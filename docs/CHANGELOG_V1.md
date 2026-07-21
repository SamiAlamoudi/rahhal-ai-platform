# CHANGELOG — Rahhal V1

## [1.0.0] — GA + post-GA stack (through Sprint 73)

### Added (Sprints 65–70 — GA)
- Production hardening, E2E validation, beta launch, deployment, operations
- GA release manager & version manifest 1.0.0 (`src/lib/ops/release`)

### Added (Sprints 71–73 — library engines)
- Provider Runtime (`src/lib/agent/providerRuntime`) — Sprint 71
- Flight Search Engine (`src/lib/agent/flightSearchEngine`) — Sprint 72
- Hotel Search Engine (`src/lib/agent/hotelSearchEngine`) — Sprint 73

### Safe defaults
- Mock payments (`VITE_PAYMENT_PROVIDER=mock`)
- Live providers gated OFF

### Notes
- Additive modules only — no RahhalBrain / Conversation Engine rewrites
- Package version `1.1.0-rc.1`; product GA version `1.0.0`
- Primary `/chat` traveler path uses Aggregation + Booking Intelligence; S72/S73 engines are library-verified and await product wiring
