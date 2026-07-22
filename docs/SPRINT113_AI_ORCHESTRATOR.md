# Sprint 113 — AI Orchestrator (Production)

**Type:** Additive coordination layer (`src/lib/agent/orchestrator`)  
**Position:** Conversation → **AI Orchestrator** → Memory → Search/Providers → Trip Builder → Decision → Response Composer → Concierge → Final Response

## Architecture

```
Conversation
        ↓
AI Orchestrator   ← Sprint 113
        ↓
Memory
        ↓
Search Planner / Providers
        ↓
Trip Builder
        ↓
Decision Engine (pass-through confidence — engine unmodified)
        ↓
Response Composer
        ↓
Concierge
        ↓
Final Response
```

The orchestrator **calls public APIs only**. It does not modify Memory, Search Planner, Provider Gateway, Trip Builder, Decision Engine, Response Composer, or Concierge.

Distinct from:
- `brain.ai_orchestrator` (Sprint 43 `src/lib/aiOrchestrator`)
- `booking.orchestrator` (Sprint 94)

## Feature flag

`ai.orchestrator` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | `runAIOrchestrator` returns `{ enabled: false }` — legacy paths unchanged |
| ON | Builds an execution plan and runs selected stages |

## Execution order

1. Validate input  
2. Plan stages (memory / search / cache / trip builder / decision / composer / concierge / early exit)  
3. Execute planned stages with metrics  
4. Assemble final response  

### Planner decisions

- Use memory when `userId` is present (unless overridden)
- Skip providers when offers already supplied or providers unavailable
- Reuse cached final response when `cacheKey` + `cachedFinalResponse` present
- Ask follow-up / early exit when destination or departure date missing
- Skip Trip Builder / Concierge when plan says so

## Validation

`OrchestratorValidator` rejects malformed messages / flights / hotels / budget.

## Metrics

Pipeline duration, per-stage timings (memory, planner, providers, trip builder, decision, response, concierge), token estimate, confidence, completed/skipped/failed counts.

## Verify

```bash
npm run orchestrator:verify
```

Runs lint, typecheck, build, and Sprint 113 tests.
