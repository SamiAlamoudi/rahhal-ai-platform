# Sprint 114 — Intelligent Itinerary Engine (Production)

**Type:** Additive itinerary layer (`src/lib/agent/itinerary`)  
**Position:** Conversation → AI Orchestrator → Memory → Planner → Providers → Trip Builder → **Itinerary Engine** → Decision Engine → Response Composer → Concierge → Final Response

## Architecture

```
Trip Builder output (TripCandidate / flights+hotels+dates)
        ↓
normalizeItineraryContext (DayPlanner)
        ↓
planDays — arrival / full / departure days, multi-city assignment
        ↓
per day:
  TransferPlanner (flight arrival/departure + airport transfers)
  CheckInPlanner (hotel check-in / check-out)
  MealPlanner (breakfast / lunch / dinner windows)
  ActivityAllocator (sightseeing, walking, meetings, free time)
  planInterCityTransfer (when city changes)
        ↓
TimelineBuilder — sort + morning/afternoon/evening/night
        ↓
ConflictResolver — detect & auto-resolve overlaps / late arrival / check-in / early departure
        ↓
ItineraryScorer + ItineraryExplainer + ItineraryMetadata
        ↓
ItineraryEngineResult
```

Modules:

| File | Role |
|------|------|
| `ItineraryEngine.ts` | Orchestrates the pipeline; feature-flag gate |
| `DayPlanner.ts` | Normalize input; split stay into days |
| `TimelineBuilder.ts` | Day-part partitions + flatten timeline |
| `TransferPlanner.ts` | Airport / inter-city transfers + shared planners |
| `CheckInPlanner.ts` | Hotel check-in / check-out |
| `MealPlanner.ts` | Meal windows |
| `ActivityAllocator.ts` | Sightseeing, meetings, walking, free time |
| `ConflictResolver.ts` | Detect + auto-resolve schedule conflicts |
| `ItineraryScorer.ts` | Comfort / walking / efficiency / family / business / overall |
| `ItineraryExplainer.ts` | Why activities, order, hotels, flights |
| `ItineraryMetadata.ts` | Travel time, nights, walking, confidence, … |
| `feature.ts` / `types.ts` / `index.ts` | Flag, contracts, barrel |

## Pipeline placement

Downstream of Trip Builder, upstream of Decision Engine. This sprint ships the engine as an **additive library**; Orchestrator / Decision Engine / Concierge are **not** modified. Callers enable via `ai.itinerary_engine` and `runItineraryEngine`.

## Timeline generation

For each day the engine produces blocks covering:

- Morning / Afternoon / Evening / Night partitions
- Hotel check-in / check-out (arrival & departure days)
- Flight arrival / departure anchors
- Transfers (airport and inter-city)
- Walking buffers
- Meals
- Sightseeing / business meetings
- Free time / rest

Supports leisure, family, business, and multi-city stays.

## Conflict resolution

Detects:

- Overlapping activities
- Late arrivals
- Missed check-in (before arrival)
- Early departures (checkout after flight)
- Impossible schedules

Resolves by shifting soft blocks, deferring check-in, moving checkout earlier, or dropping low-priority free/walking blocks.

## Scoring

| Score | Meaning |
|-------|---------|
| `comfort` | Free time vs walking load / delays |
| `walking` | Inverse of walking minutes |
| `travelEfficiency` | Activities vs transfer load |
| `familyFriendliness` | Free time + meals − heavy walking |
| `businessSuitability` | Meeting density / trip length |
| `overallQuality` | Weighted blend |

## Metadata

`totalTravelTimeMinutes`, `hotelNights`, `flightDurationMinutes`, `walkingDurationMinutes`, `transferDurationMinutes`, `activityCount`, `freeHours`, `dayCount`, `cityCount`, `confidence`, `style`, conflict counts.

## Feature flag

`ai.itinerary_engine` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | `runItineraryEngine` returns `{ enabled: false, empty: true }` — legacy unchanged |
| ON | Trip Builder-shaped input flows through the itinerary pipeline |

## Verify

```bash
npm run itinerary:verify
```

Runs lint, typecheck, build, and Sprint 114 tests.
