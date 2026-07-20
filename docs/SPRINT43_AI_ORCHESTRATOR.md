# Sprint 43 — Rahhal AI Orchestrator & Tool Routing

Production AI orchestration layer for Rahhal. **Routes and synthesizes only** — reuses every existing engine without duplicating business logic.

## Non-goals (strict)

- Do not rebuild AI Conversation, Booking, Travel Execution, Payments, Refund Policy, Disruption, Loyalty, Travel Documents/Visa, Supplier Marketplace, Finance, or Trip Timeline engines
- Do not invent new pricing / refund / recovery / visa rules inside the orchestrator
- Do not expose internal engine names in user-facing copy
- Do not enable live payments (`VITE_PAYMENT_PROVIDER` stays `mock`)

## Architecture

```
User utterance
  → IntentRouter (tool selection)
  → Planner (Plan → Execute → Observe → Continue)
  → MemoryBridge (Sprint 28 slots first)
  → ParallelExecutor (independent tools)
  → ToolAdapters (thin calls into existing engines)
  → ResultRanker (price / quality / refund / supplier / time / loyalty / prefs)
  → ResponseBuilder (one coherent answer + Sprint 42 card meta)
  → ConversationController (when brain.ai_orchestrator ON)
```

| Module | Responsibility |
|--------|----------------|
| `intentRouter.ts` | Map utterances → logical tools |
| `planner.ts` | Plan / Execute / Observe / Continue + parallel waves |
| `memoryBridge.ts` | Reuse Sprint 28 budget, travellers, passport, nationality, airlines, hotels, seats, loyalty |
| `parallelExecutor.ts` | Concurrent independent tool waves |
| `toolAdapters.ts` | Thin wrappers over UnifiedTravelPlanner search helpers + engines 36–41 + trips |
| `resultRanker.ts` | Merge & score recommendations |
| `responseBuilder.ts` | Single conversational answer + Sprint 42 UI meta |
| `observability.ts` | selected tools, timing, planner decisions, fallbacks, errors |
| `RahhalAiOrchestrator.ts` | Facade |

## Example routes

| Utterance | Tools |
|-----------|-------|
| “I want to travel to Morocco.” | destination, flights, hotels, visa, insurance, activities |
| “I need the cheapest option.” | supplier marketplace, loyalty, finance, refund policy |
| “My flight was cancelled.” | disruption → refund, loyalty, timeline, supplier (parallel) |
| “I lost my passport.” | travel documents → visa, timeline, notifications (parallel) |

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `ai_orchestrator` | `brain.ai_orchestrator` | `brain.conversation_ui`, `brain.finance_platform` |

When OFF, ConversationController keeps existing single-engine query handlers + UnifiedTravelPlanner path.

## Observability

Each turn logs:

- selected tools
- execution time
- planner decisions (stages + waves)
- fallback reasons
- errors

## Conversation output

- One coherent answer
- No internal engine names
- `uiMeta.cards` / structured flights & hotels for Sprint 42 rich cards

## Tests

`src/lib/__tests__/aiOrchestrator.sprint43.test.ts`

Covers: single-tool routing gate, multi-tool requests, parallel execution, planner, fallback, memory reuse, tool routing, ConversationController integration.
