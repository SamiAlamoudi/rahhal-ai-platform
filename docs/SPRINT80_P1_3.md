# Sprint 80 P1-3 — Provider Unification

**Baseline:** `main` @ `3c74475` (PR #314 — Sprint 80 P1-1 museum deletion)  
**Branch:** `cursor/sprint80-p1-3-provider-unify-71ec`

## Goal

Introduce a single provider abstraction for conversational travel search so
flights, hotels, and future domains share one interface — without changing
voice, STT/TTS, conversation engine, chat brain, memory, or UI behavior.

## Architecture

```
toolBridge (flag gate)
  └─ ai.conversational_provider_unify ON
        → Request Mapper
        → Provider Resolver
        → Provider Registry → ConversationalTravelProvider.search
        → Response Normalizer
        → toolData (same shape as legacy)
  └─ flag OFF (default)
        → existing live-or-mock bridges (unchanged)
```

| Module | Responsibility |
| --- | --- |
| `types.ts` | Shared `ConversationalTravelProvider` interface |
| `registry.ts` | Register / list providers by domain + id |
| `resolver.ts` | Order candidates (live → mock when live flags ON) |
| `requestMapper.ts` | `AgentToolContext` → `UnifiedProviderRequest` |
| `responseNormalizer.ts` | Tool payloads → `UnifiedProviderOffer[]` |
| `errors.ts` | Taxonomy + classification + graceful message |
| `adapters/*` | Wrap existing mock engines + live bridges |
| `search.ts` / `bridge.ts` | Orchestrator + toolBridge entry |
| `feature.ts` | `ai.conversational_provider_unify` (default **OFF**) |

## Non-goals / untouched

- Voice stack, STT, TTS
- `chatEngine`, `travelAgentService.planTurn` control flow, `memory.ts`
- Chat UI / Home UI
- P1-4 live flight pilot (still gated by `ai.live_flight_search`)

## Verify

```bash
npm run lint
npm run typecheck
npm run test:run -- src/lib/__tests__/conversationalProvider.sprint80.p13.test.ts
npm run providers:check
npm run build
```
