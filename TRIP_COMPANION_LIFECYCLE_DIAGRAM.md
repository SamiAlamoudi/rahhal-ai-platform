# Live Trip Companion — Lifecycle Diagram (Sprint 7)

**Draft PR:** _(pending)_

---

## TripSession states

```mermaid
stateDiagram-v2
  [*] --> upcoming
  upcoming --> travel_day: start date arrives
  travel_day --> in_transit: boarding / en route
  in_transit --> checked_in: hotel check-in
  checked_in --> exploring: city activities
  exploring --> meeting_mode: business meeting cue
  meeting_mode --> exploring: meeting done
  exploring --> returning: return cue
  travel_day --> returning: same-day return
  returning --> completed: after end date
  upcoming --> completed: trip cancelled/ended (soft)
  completed --> [*]
```

---

## Runtime loop

```mermaid
flowchart TD
  A[Traveler message] --> B{Flag ON?}
  B -->|No| Z[Legacy planTurn unchanged]
  B -->|Yes| C{Companion ask / disruption / emergency?}
  C -->|No| Z
  C -->|Yes| D[Resolve TripSession state]
  D --> E[Build / load timeline events]
  E --> F{Disruption?}
  F -->|Yes| G[Replan timeline]
  F -->|No| H[Annotate current/next/late/missed]
  G --> H
  H --> I[Prepare notifications]
  I --> J[Context memory + location abstraction]
  J --> K{Emergency?}
  K -->|Yes| L[Emergency framework steps]
  K -->|No| M[Assistant answer]
  L --> N[Consultant summary]
  M --> N
  N --> O[Soft enrich reply + meta]
```

---

## Timeline status legend

| Status | Meaning |
|---|---|
| upcoming | Not started |
| current | In progress |
| late | Overdue / cutting it close |
| missed | Window passed |
| skipped | Traveler skipped |
| rescheduled | Moved by replan |
| done | Completed window |
