# Sprint 37 — Travel Disruption & Smart Recovery Engine

Detects travel disruptions, evaluates passenger impact, searches recovery options, ranks plans, updates the trip, and explains outcomes in conversation.

## Non-goals

- Do not rewrite UnifiedTravelPlanner, TravelExecutionEngine, Payments Platform, or Refund Policy Engine
- Recovery search is deterministic sandbox inventory — no live airline/hotel rebooking APIs
- Flight status monitoring remains in Sprint 35 `FlightStatusMonitor`; this engine consumes signals and user text
- Money movement / refunds stay in Sprints 34–36

## Architecture

```
Conversation / signals
  → TravelDisruptionEngine.handle / handleFromUserText
       ├─ DisruptionDetector (event type + severity)
       ├─ ImpactCalculator (passenger impact)
       ├─ RecoverySearcher (alt flight/hotel/car/activity/transport/route)
       ├─ RecoveryRanker (AI decision scoring)
       ├─ TripUpdateService (itinerary / hotel / activities / transport / docs)
       ├─ NotificationScheduler (Sprint 35 channels)
       ├─ DisruptionExplainer (natural language EN/AR)
       └─ DisruptionEvents + DisruptionMetrics
```

## Supported events

Flight delayed · Flight cancelled · Gate changed · Schedule changed · Missed connection · Hotel overbooking · Hotel unavailable · Car unavailable · Activity cancelled · Airport closure · Weather disruption · Strike · Visa rejection · Border restriction

## Recovery ranking factors

Lowest total cost · Earliest arrival · Minimum disruption · Traveler preferences · Loyalty programs · Cabin class · Hotel rating · Family/business traveler · Visa restrictions · Conversation context

## Conversation examples

- "My flight is delayed"
- "My flight was cancelled"
- "I missed my connection"
- "My hotel cancelled my reservation"

Policy questions such as "What happens if my flight is delayed?" remain Sprint 36 refund policy.

## Feature flag

| ID | Default | Depends on |
|----|---------|------------|
| `brain.travel_disruption_engine` | **OFF** | `brain.refund_policy_engine` |

## Modules

`src/lib/disruption/`

## Tests

`src/lib/__tests__/travelDisruptionEngine.sprint37.test.ts`
