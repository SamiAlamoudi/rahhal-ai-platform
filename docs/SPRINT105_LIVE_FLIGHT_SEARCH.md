# Sprint 105 — Live Flight Search (Amadeus Production Bridge)

**Type:** Additive agent bridge (`src/lib/agent/liveFlightSearch`)  
**Depends on:** Sprint 104 Provider Gateway · Sprint 92 Amadeus Sandbox OAuth

## Architecture

```
Conversation
        ↓
SearchPlanner
        ↓
Provider Gateway
        ↓
Provider Registry
        ↓
Amadeus Adapter (existing OAuth)
        ↓
Flight Offers Search API
        ↓
GatewayResponse
        ↓
Rahhal Search Result
        ↓
Decision Engine
        ↓
Conversation UI
```

## Feature flag

`ai.live_flight_search` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | Runner returns `{ enabled: false }` — no provider calls |
| ON | Validate → Gateway → Amadeus → Rahhal flight offers |

## Verify

```bash
npm run live-flight-search:verify
```
