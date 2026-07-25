# Trip Orchestrator — Execution Graph (Sprint 4)

```text
                    ┌─────────────────────┐
                    │  Traveler utterance │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ planTurn (owner)    │
                    │ extract + tools     │
                    └──────────┬──────────┘
                               ▼
              flag ai.integration_trip_orchestrator?
                     OFF ──► legacy enrich chain
                     ON
                               ▼
                    ┌─────────────────────┐
                    │ TripOrchestrator    │
                    └──────────┬──────────┘
                               ▼
              ┌──────── extract / seed prefs ────────┐
              │                                      │
              ▼                                      ▼
     allocate budget (+buffer)              missing fields?
              │                                      │
              ▼                                 ask only those
     ┌────────────────┐
     │ parallel group │
     │  flights tool  │◄── integrationFlightSearch
     │  hotels tool   │◄── integrationHotelSearch
     └───────┬────────┘
             ▼
        compare offers
             ▼
     recommend combo + WHY
             ▼
     detect conflicts
     (budget / dates / unavailable)
             ▼
     build itinerary skeleton
             ▼
     consultant summary
             ▼
     learn preferences
             ▼
     soft-enrich TripPlan ──► budget / decision / … (existing)
```

## Step statuses

| Step | Parallel | Notes |
|---|---|---|
| extract | — | Scenario label (family/business/…) |
| budget | — | Uses `allocateBudget` + 8% buffer |
| search_flights | group 1 | Skipped if offers already from tools |
| search_hotels | group 1 | Skipped for `flights_only` |
| compare | — | Score / price pick |
| recommend | — | Combo + trade-offs |
| itinerary | — | Arrival → days → return |
| summarize | — | AR/EN consultant narrative |
