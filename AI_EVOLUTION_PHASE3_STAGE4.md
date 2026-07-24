# AI Evolution — Phase 3 Stage 4

**Travel Intelligence Layer**

| Item | Value |
|------|--------|
| Flag | `ai.travel_intelligence` |
| Default | **OFF** |
| Base | Phase 3 Stage 3 Proactive Travel Advisor (dependency only) |
| Scope | Isolated alternative evaluation · metadata only · **not wired into planTurn** |

---

## Goal

Evaluate multiple travel options (compare, trade-offs, confidence, rank, justify) without changing any production planning or prior Phase 3 layers.

---

## Architecture

```
Consumer (tests / future integrator)
    → runTravelIntelligence / enrichTurnWithTravelIntelligence
        → generate alternatives
        → compare dimensions
        → score decisions
        → analyze trade-offs
        → confidence + rank + explain
        → attach meta.travelIntelligence ONLY
    → tripPlan / reply / planTurn unchanged
```

`planTurn()` is **not modified** in this stage. Production path remains identical while the flag is OFF (and even when ON, until a future stage explicitly wires enrichment).

---

## Deliverables

- `src/lib/agent/intelligence/*`
- Feature registry entry `ai.travel_intelligence` (experimental, OFF)
- `AgentProviderMeta.travelIntelligence` type
- Docs: `AI_TRAVEL_INTELLIGENCE.md`, this file
- New tests: `src/lib/__tests__/travelIntelligence.phase3.stage4.test.ts`

---

## Validation

```
npm run lint
npm run typecheck
npm run arch:circular
npm run test:run
```

---

## Non-goals

- Modifying or merging previous PRs  
- Refactoring Stages 1–3  
- Changing `planTurn` / tripPlan / destinations / pricing / itinerary  
- Changing Runtime Coordinator / Consultant Pipeline / Unified Response  
- Changing Conversation Orchestrator / Multi-Turn / Proactive Advisor  
- Voice playback / Knowledge loading / Memory overwrite  
