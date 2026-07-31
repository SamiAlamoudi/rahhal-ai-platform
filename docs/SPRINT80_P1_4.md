# Sprint 80 P1-4 — Live Flight Provider Pilot

**Baseline:** `main` @ `f263036` (PR #315 — Sprint 80 P1-3 provider unify)  
**Branch:** `cursor/sprint80-p1-4-live-flight-pilot-71ec`

## Goal

First safe live-provider pilot using the unified conversational provider layer:
route **only** `runConversationAwareFlightSearch()` through the provider resolver
with **Amadeus LiveFlightProvider**, and silently fall back to the legacy Flight
Search Engine on failure.

## Architecture

```
runConversationAwareFlightSearch
  ├─ ai.live_flight_provider_pilot ON (default OFF)
  │     → Provider Resolver → LiveFlightProvider (Amadeus)
  │     → success: exact legacy live tool schema
  │     → unavailable / timeout / auth / parse → silent legacy runFlightSearchTool
  │     → FlightPilotTelemetry (provider, fallback, latency, ok)
  ├─ ai.conversational_provider_unify ON (unchanged from P1-3)
  └─ legacy live-or-mock bridges (default)
```

Hotels: **unchanged** (no pilot gate on hotel toolBridge).

## Feature flags

| Flag | Default | Role |
| --- | --- | --- |
| `ai.live_flight_provider_pilot` | **OFF** | Enables flight pilot routing |
| `ai.conversational_provider_unify` | OFF | P1-3 general unify (hotels+flights) |
| `ai.live_flight_search` | OFF | Sprint 105 runner (pilot calls with enabled:true override) |

## Non-goals / untouched

Voice · STT · TTS · chatEngine · memory · booking · payments · UI · itinerary

## Verify

```bash
npm run lint
npm run typecheck
npm run test:run -- src/lib/__tests__/liveFlightProviderPilot.sprint80.p14.test.ts
npm run providers:check
npm run production:verify
npm run build
```
