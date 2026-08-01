# Sprint 80 P2 — End-to-End Live Flight Validation

**Baseline:** P1-4 branch `cursor/sprint80-p1-4-live-flight-pilot-71ec` @ `b348a7f`  
**Branch:** `cursor/sprint80-p2-live-flight-validation-71ec`

## Goal

Validate the complete live flight provider pipeline through the new conversational
provider architecture (Amadeus LiveFlightProvider → resolver → normalize),
compare against the legacy Flight Search Engine path, and produce latency +
telemetry rates — **without enabling any production flags**.

## Architecture

```
runLiveFlightValidation (dev/staging only)
  ├─ Gate: block production; require sandbox host for live
  ├─ Pilot: runLiveFlightProviderPilot (Amadeus via unified layer)
  ├─ Legacy: runFlightSearchTool (mock engine baseline)
  ├─ Inspect: auth, mapping, normalize, price, carrier, baggage, fare, cabin
  ├─ Compare: every pilot↔legacy difference
  └─ Report: latency + telemetry rates (markdown/JSON)
```

## Feature flags (production unchanged)

| Flag | Default | P2 behavior |
| --- | --- | --- |
| `ai.live_flight_provider_pilot` | **OFF** | Hard-blocked on production even if flipped |
| `ai.live_flight_search` | OFF | Unchanged |
| `ai.conversational_provider_unify` | OFF | Unchanged |

Pilot may activate only on **development / staging / preview / beta**.

## How to run

```bash
# CI-safe (mock Amadeus via injectable runLive)
npm run live-flight-p2:verify

# CLI summary + artifact
npm run live-flight-p2:validate

# Real Amadeus (staging/dev only — secrets required)
VITE_DEPLOY_TARGET=staging \
AMADEUS_BASE_URL=https://test.api.amadeus.com \
AMADEUS_API_KEY=… AMADEUS_API_SECRET=… \
npm run live-flight-p2:verify
```

## Untouched

Voice · STT/TTS · Chat Engine · Memory · Booking · Payments · UI

## Known mapper gaps (expected differences)

The Sprint 105 Rahhal flight mapper currently does **not** populate `baggage` or
`fareFamily` on live offers. The P2 comparator records these as warnings so they
are visible in every report until a follow-up enrichment sprint.
