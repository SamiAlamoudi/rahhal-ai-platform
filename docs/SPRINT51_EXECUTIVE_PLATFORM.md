# Sprint 51 — Rahhal Executive Travel Platform v1

Production-grade executive OS on the `/chat` path. **RahhalBrain remains the only orchestrator.** Specialized capabilities are Executive Engines under `src/lib/brain/executive/`.

## Architecture

```
User → RahhalBrain
         → Phase 2 executive (context / reject / optimize)
         → Sprint 51 Executive Platform
              → selected engines (analyze → plan → execute)
         → Reflection / Response
         → Existing services
```

## Engine contract

Every engine exposes:

- `metadata()`
- `analyze(ctx)`
- `plan(ctx, analysis)`
- `execute(ctx, plan)`
- `confidence(ctx, analysis)`

## Engines

| Engine | ID |
|--------|----|
| Trip Monitor | `trip_monitor` |
| Live Concierge | `live_concierge` |
| Explainable Decision | `explainable_decision` |
| Travel Memory | `travel_memory` |
| Multimodal Document | `multimodal_document` |
| Budget Intelligence v2 | `budget_intelligence_v2` |
| Itinerary Optimizer | `itinerary_optimizer` |
| Risk | `risk` |
| Executive Response | `executive_response` |
| Learning | `learning` |

## Feature flag

- `ai.executive_platform` (default **ON**)
- Depends on `ai.travel_executive`, `ai.rahhal_brain`
- Meta: `AgentProviderMeta.executivePlatform`

## Package layout

```
src/lib/brain/executive/
  platform/     # contract, registry, orchestrator, feature
  engines/      # ten specialized engines
  *.ts          # Phase 2 modules (unchanged API)
```

## Non-goals

- UI rewrite
- Parallel AI pipelines
- Enabling experimental `brain.*` stack
- Live airline/hotel APIs (deterministic priors + signals)

## Tests

`src/lib/__tests__/executivePlatform.sprint51.test.ts`
