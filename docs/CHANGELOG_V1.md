# CHANGELOG — Rahhal V1

## [1.0.0] — GA + post-GA production stack (through Sprint 73.5)

### Added (Sprint 65–70 — GA)
- Production hardening (`src/lib/ops/production`)
- End-to-end production validation (`src/lib/ops/validation`)
- Beta launch environment & live provider activation (`src/lib/ops/beta`)
- Production deployment & launch automation (`src/lib/ops/deployment`)
- Real beta operations & production monitoring (`src/lib/ops/operations`)
- GA release manager & version manifest 1.0.0 (`src/lib/ops/release`)

### Added (Sprint 71–73 — search/provider stack)
- Provider Runtime framework (`src/lib/agent/providerRuntime`) — Sprint 71
- Flight Search Engine (`src/lib/agent/flightSearchEngine`) — Sprint 72
- Hotel Search Engine (`src/lib/agent/hotelSearchEngine`) — Sprint 73

### Changed (Sprint 73.5 — production cleanup)
- Removed unused Sprint 18/19 React hook + presentational UI wrappers
- Removed unused integration provider barrels
- Synchronized release / status / roadmap documentation through Sprint 73.5

### Safe defaults
- Mock payments (`VITE_PAYMENT_PROVIDER=mock`)
- Live providers gated OFF (`ai.live_providers`, `provider.*`, `providers.live_master`)

### Notes
- Additive ops and search engines only — no RahhalBrain / Conversation Engine rewrites
- Package version remains `1.1.0-rc.1`; product GA version remains `1.0.0`
