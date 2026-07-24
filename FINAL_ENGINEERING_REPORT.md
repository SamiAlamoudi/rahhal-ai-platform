# Final Engineering Report — Pre–Feature-Development Gate

**Branch:** `cursor/production-authority-7518`  
**PR:** #204  
**Role:** Principal Software Architect — technical debt elimination only  
**Date:** 2026-07-24

## Stable systems (must not be rewritten)

- Decision Engine  
- Planning Draft  
- Conversation Brain  
- Smart Clarification  
- Production Authority infrastructure  
- OpenAI Proxy  
- Booking Proxy  

## Debt-cleanup objectives → status

| Task | Status |
|------|--------|
| Extract every `planTurn` stage body into dedicated modules | **Done** |
| `travelAgentService.ts` thin orchestrator only (for `planTurn`) | **Done** (`planTurn` → `runPlanTurn`; file ~935 LOC; `runToolsForPlan` remains factory-local) |
| Stages: clear responsibility, typed I/O, unit tests | **Done** |
| `EDGE_ALLOWED_ORIGINS` configurable for Prod / Staging / Local | **Done** |
| Rental Proxy scaffold (disabled by default) | **Done** |
| Verify no client secret can be referenced in SPA | **Done** (+ regression tests) |
| Full repo validation | **Done** (see below) |

## Architecture after debt cleanup

```
createTravelAgentService()
  └─ planTurn(input) → runPlanTurn(input, planTurnDeps)
        ├─ stageInitMemory        → stages/initMemory.ts
        ├─ stagePreBrainEnrichers → stages/preBrainEnrichers.ts
        ├─ stageRahhalBrain       → stages/rahhalBrain.ts
        ├─ stageBrainPipeline     → stages/brainPipeline.ts
        ├─ stageEarlyIntentRouters→ stages/earlyIntentRouters.ts
        ├─ stageConcierge         → stages/concierge.ts
        ├─ stageLlmAndTools       → stages/llmAndTools.ts  (deps.runToolsForPlan)
        ├─ stageAutonomous        → stages/autonomous.ts
        ├─ stagePresentation      → stages/presentation.ts
        └─ stageFinalSpeak        → stages/finalSpeak.ts
```

Shared types: `planTurn/context.ts` (`PlanTurnContext`, `PlanTurnDeps`).  
Abort: `planTurn/abortCheckpoint.ts` + thin wrappers in `planTurn/stages.ts`.

## EDGE CORS configurability

Documented and implemented in:

- `src/lib/ops/security/edgeCorsAllowlist.ts` (unit-tested)
- `supabase/functions/_shared/edgeSecurity.ts`
- `api/_lib/edgeSecurity.ts`

| Target | Empty allowlist behavior | Override env |
|--------|--------------------------|--------------|
| local / development | `*` (tooling) | `EDGE_ALLOWED_ORIGINS_LOCAL` |
| staging / preview | `null` (fail closed) | `EDGE_ALLOWED_ORIGINS_STAGING` |
| production | `null` (fail closed) | `EDGE_ALLOWED_ORIGINS_PRODUCTION` |

Primary: `EDGE_ALLOWED_ORIGINS` / `OPS_ALLOWED_ORIGINS`.  
Selector: `EDGE_DEPLOY_TARGET` | `DEPLOY_TARGET` | `VITE_DEPLOY_TARGET`.  
Escape hatch: `EDGE_CORS_PERMISSIVE=true` (not for production defaults).

## Rental proxy scaffold

- `supabase/functions/rental-proxy/index.ts`
- `api/rental-proxy.ts`

Returns `503 RENTAL_PROXY_DISABLED` unless `RENTAL_PROXY_ENABLED=true`.  
No SPA adapter wiring — **zero runtime behavior change**.

## Client secrets — SPA verification

Forbidden `VITE_*` keys hard-failed by `validateEnvironment` (all targets), including OpenAI, RapidAPI, Booking, Rental, Weather, Maps, Moyasar, Amadeus.  

Repo scan: **no** `import.meta.env.VITE_*` reads of those secret keys remain in `src/` (proxy URLs / models only).  

Regression: `src/lib/__tests__/productionAuthority.debtCleanup.test.ts`.

## Validation

```
npm run lint        → pass
npm run typecheck   → pass
npm run test:run    → pass (full suite)
```

## Remaining engineering concerns (before feature work resumes)

These are **not blockers** for correctness of the current production path; they are the backlog to clear or consciously accept before large feature sprints.

1. **`runToolsForPlan` still lives inside `createTravelAgentService`** (~400 LOC). Next debt pass can extract it behind the existing `PlanTurnDeps.runToolsForPlan` signature without touching AI cores.
2. **planTurn stage unit tests are behavioral smoke tests**, not exhaustive golden masters of every router branch. Prefer contract/integration tests already covering travelAgent; expand stage tests only when changing a stage.
3. **Rental live path unfinished** — scaffold exists; SPA still mock-default. Enabling requires `RENTAL_PROXY_ENABLED`, server key, SPA proxy URL, and adapter work (separate sprint).
4. **Weather / Maps integration registry** still builds live adapters from **server** `process.env` keys in Node; browser path already uses proxies. Keep forbidding `VITE_*` secrets.
5. **CORS allowlist must be set in real staging/production** Edge secrets; empty + non-permissive yields `Access-Control-Allow-Origin: null`.
6. **Chat experience quarantine is partial** — ChatPage/MessageBubble lazy-load the heavy path; some experience card modules still import the conversationExperienceUi barrel. Further leaf imports are optional chunk wins.
7. **Docs drift** — some older docs may still mention `VITE_OPENAI_API_KEY` / warn-only RapidAPI; treat `.env.example` + this report as source of truth until docs are scrubbed.
8. **ops-health remains unauthenticated** by design (LB probes); never return secrets there.
9. **Duplicate allowlist logic** across Deno Edge / Vercel `_lib` / `edgeCorsAllowlist.ts` — intentional (runtime isolation); keep semantics in lockstep when changing CORS rules.

## Explicit non-goals honored

- No new product features  
- No AI core rewrites  
- No OpenAI / Booking proxy redesign  
- No intentional behavior / API / AI response changes  

## Recommendation

**Feature development may resume** on top of this branch after PR #204 merge, with the stable cores and Production Authority surface treated as frozen unless a production incident requires a surgical fix.
