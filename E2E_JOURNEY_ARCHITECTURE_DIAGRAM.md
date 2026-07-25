# End-to-End Journey — Architecture Interaction Diagram (Sprint 12)

**Branch:** `cursor/e2e-journey-integration-7518`  
**Draft PR:** _(pending)_  
**Flag:** `ai.integration_journey` (default OFF)

```
                         ┌──────────────────────────┐
                         │   planTurn (sole owner)  │
                         └────────────┬─────────────┘
                                      │
                    soft enrich (flags OFF by default)
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
  Destination / Companion /    JourneyEngine (S12)          Action / Disruption
  Maps / Budget (S5–S9)        coordinator only             (S10–S11)
         │                            │                            │
         │                     ┌──────┴──────┐                     │
         │                     │   Handoff   │◄── AgentMemory      │
         │                     │  Context    │    TripPlan         │
         │                     └──────┬──────┘    known slots      │
         │                            │                            │
         │                     ┌──────┴──────┐                     │
         │                     │   Shared    │  budget·timeline    │
         │                     │  Decision   │  flights·hotels     │
         │                     │   Engine    │  maps·risk·prefs    │
         │                     └──────┬──────┘                     │
         │                            │                            │
         │                     ┌──────┴──────┐                     │
         │                     │ Observability│                    │
         │                     │ conv·decision│                    │
         │                     │ ·execution   │                    │
         │                     └──────┬──────┘                     │
         │                            │                            │
         └──────────── soft-activate (optional) ───────────────────┘
                      child flags stay OFF unless enabled
```

**Lazy loading:** `loadIntegrationJourney` + child `import()` only when journey activates a stage.
