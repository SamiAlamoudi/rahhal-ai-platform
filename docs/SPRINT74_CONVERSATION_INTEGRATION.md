# Sprint 74 — Conversation → Real Search Integration

**Type:** Integration only  
**Base:** Sprint 71 Provider Runtime · Sprint 72 Flight Search Engine · Sprint 73 Hotel Search Engine  
**QA-0 finding fixed:** engines were library-ready but not on the traveler conversation path.

## Goal

Wire `/chat` → `planTurn` → agent tools so **flights** and **hotels** call the production search engines (via Provider Runtime) instead of legacy Aggregation Engine adapters.

## Architecture (unchanged layers)

```
User message
    ↓
RahhalBrain / Conversation (unchanged)
    ↓
Intent + TripRequirements extract (unchanged)
    ↓
Agent tools: flights / hotels   ← Sprint 74 wire
    ↓
searchEngineBridge
    ├── Flight Search Engine (Sprint 72)
    │       └── Provider Runtime (Sprint 71)
    └── Hotel Search Engine (Sprint 73)
            └── Provider Runtime (Sprint 71)
    ↓
Normalized offers / stays (tool contract preserved)
    ↓
mergeToolResults + Intelligent Decision Engine
    ↓
Booking Intelligence (unchanged, parallel enrichment)
    ↓
Itinerary + traveler response
```

Weather / maps / visa / attractions / currency / transportation remain on Aggregation Engine.

## Conversation flow

1. Traveler: “I want to travel from Riyadh to Tokyo next month.”
2. Extract origin, destination, dates, travelers, budget.
3. Autonomous / tool planner selects `flights` + `hotels` (unless `flights_only`).
4. `createMockFlightSearchTool` → `getDefaultFlightSearchEngine().search*`  
   `createMockHotelSearchTool` → `getDefaultHotelSearchEngine().searchHotels`
5. Bridge maps city names → IATA, builds one-way / round-trip / multi-city / hotel filters (business cabin, family rooms, budget/luxury).
6. Tool payloads include `offers` / `stays` plus **highlights** (best / cheapest / fastest).
7. Decision engine ranks; Conversation Brain speaks recommendations + itinerary.
8. Mock mode default; live mode when Provider Runtime flags + secrets exist (no Runtime changes).

## Integrated components

| Component | Role |
| --- | --- |
| `src/lib/agent/tools/searchEngineBridge.ts` | Request/result mapping |
| `src/lib/agent/tools/mockTools.ts` | flights/hotels tools → engines |
| `src/lib/agent/tools/stubs.ts` | Default registry documentation |
| Sprint 71 / 72 / 73 modules | Unmodified engines + runtime |

## Files changed

- `src/lib/agent/tools/searchEngineBridge.ts` (new)
- `src/lib/agent/tools/mockTools.ts`
- `src/lib/agent/tools/stubs.ts`
- `src/lib/agent/tools/mergeToolResults.ts` (labeling only)
- `src/lib/agent/index.ts` (exports)
- `src/lib/__tests__/conversationSearch.sprint74.test.ts` (new)
- `src/lib/__tests__/travelAgent.tools.test.ts`
- `src/lib/__tests__/travelAgent.toolExecutor.test.ts`
- `docs/SPRINT74_CONVERSATION_INTEGRATION.md`
- `package.json` (`conversation:verify`)

## Validation

| Gate | Command |
| --- | --- |
| Lint / typecheck / tests / build | `npm run lint` · `typecheck` · `test:run` · `build` |
| Circular deps | `npm run arch:circular` |
| Runtime / flights / hotels | `runtime:verify` · `flights:verify` · `hotels:verify` |
| Conversation integration | `npm run conversation:verify` |

## Known limitations

- Booking Intelligence still runs its **own** provider search in parallel (not replaced — additive).
- Live providers require Edge secrets + feature flags (default OFF).
- Aggregation Engine retained for non-flight/hotel domains.
- Hotelbeds remains an engine-local future stub.

## Next Sprint recommendations

1. Optionally feed engine offers into Booking Intelligence adapters (single search SoT).
2. Surface engine diagnostics in traveler-facing graceful copy for live outages.
3. Browser E2E for Riyadh→Tokyo on `/chat`.
4. Production cleanup of unused Sprint 18/19 UI if still open.

## Success criterion

A traveler asking to travel **Riyadh → Tokyo** automatically executes the integrated Flight + Hotel Search Engines (providerIds `flight-search-engine` / `hotel-search-engine`) instead of legacy `aggregate-flights` / `aggregate-hotels`.
