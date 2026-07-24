# AI Evolution — Phase 3 Stage 3

**Proactive Travel Advisor**

| Item | Value |
|------|--------|
| Flag | `ai.proactive_advisor` |
| Default | **OFF** |
| Base | Phase 3 Stage 2 Multi-Turn Conversation Manager |
| Scope | Additive metadata-only opportunity recommendations |

---

## Goal

Instead of only answering requests, Rahhal proactively recognizes opportunities to help (visa, weather, budget, family, business, etc.) — without changing any planning or conversation engines.

---

## Architecture

```
planTurn production result
    → (optional) Multi-Turn / Orchestrator / Runtime / Pipeline enrichment
    → Proactive Travel Advisor (flag ON)
        → build read-only context
        → detect signals
        → score confidence + priority
        → attach meta.proactiveAdvisor ONLY
    → return turn (tripPlan + reply unchanged by this layer)
```

When the flag is **OFF**, behavior matches prior Phase 3 / Phase 2 paths exactly.

---

## Deliverables

- `src/lib/agent/proactive/*`
- Feature registry entry `ai.proactive_advisor` (experimental, OFF)
- Optional `proactiveAdvisorEnabled` on `createTravelAgentService`
- `AgentProviderMeta.proactiveAdvisor`
- Docs: `AI_PROACTIVE_ADVISOR.md`, this file
- New tests: `src/lib/__tests__/proactiveAdvisor.phase3.stage3.test.ts`

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

- Voice Center implementation  
- Knowledge Center implementation  
- Memory Center overwrite semantics  
- Any planning / itinerary / pricing / recommendation engine changes  
- Merging PRs / rebasing prior evolution branches  

## Validation (Phase 3 Stage 3)

| Check | Result |
|-------|--------|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run arch:circular` | pass |
| `npm run test:run` | **2772** passed |

