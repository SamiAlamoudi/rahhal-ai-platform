# Module Map

Canonical map of Rahhal modules after the DDD façade pass. Implementations may still live under `src/lib` / `src/utils` / `src/integrations`; **public architecture entry** is `src/domains/*`.

## Top-level source tree

| Path | Role |
|------|------|
| `src/domains/` | Domain public APIs + ownership READMEs |
| `src/pages/` | Route-level UI (lazy-loaded) |
| `src/components/` | Presentational / interaction UI |
| `src/hooks/` | React hooks (UI-adjacent) |
| `src/lib/` | Domain implementations (legacy layout) |
| `src/utils/` | Core engines + contracts (legacy name) |
| `src/integrations/` | External provider adapters |
| `supabase/` | Migrations + Edge Functions |
| `api/` | Vercel-style API helpers |
| `scripts/` | CI / architecture tooling |

## Domains → implementations

| Domain | Façade | Primary implementations |
|--------|--------|-------------------------|
| **ai** | `src/domains/ai` | `lib/ai`, `lib/agent`, `lib/aiOrchestrator`, `lib/concierge` |
| **conversation** | `src/domains/conversation` | `lib/chat`, `lib/brain`, `utils/travelSession` |
| **voice** | `src/domains/voice` | `lib/chat/voice`, `lib/voiceConversation` |
| **booking** | `src/domains/booking` | `lib/booking`, `lib/bookingFlow`, `lib/bookingConfirmation`, `lib/orderManagement`, `lib/passengers` |
| **flights** | `src/domains/flights` | `lib/flightResults`, `integrations/providers/amadeus` |
| **hotels** | `src/domains/hotels` | `lib/hotels`, `integrations/providers/booking` |
| **payments** | `src/domains/payments` | `lib/payment`, `lib/payments` |
| **auth** | `src/domains/auth` | `lib/auth` |
| **notifications** | `src/domains/notifications` | `lib/notifications` |
| **shared** | `src/domains/shared` | `utils/contracts`, `lib/types` |
| **core** | `src/domains/core` | `utils/searchOrchestrator`, `liveSearchOrchestrator`, scoring/reasoning, `lib/trips`, `lib/execution` |
| **infrastructure** | `src/domains/infrastructure` | `integrations`, `lib/ops`, `lib/repositories`, `supabase` |

## AI sub-modules

| Sub-module | Façade | Backing code |
|------------|--------|--------------|
| providers | `domains/ai/providers` | `lib/agent/aggregation`, `lib/agent/providers` |
| models | `domains/ai/models` | `lib/agent/types`, `lib/agent/llm/types` |
| memory | `domains/ai/memory` | `lib/agent/memory`, `lib/brain/memory`, `conversationMemory` |
| planning | `domains/ai/planning` | `lib/ai/planning`, `buildItinerary`, `brain/tripPlanning` |
| tool-calling | `domains/ai/tool-calling` | `lib/agent/tools` |
| reasoning | `domains/ai/reasoning` | `lib/agent/decision`, `utils/reasoningEngine`, `decisionScoreEngine` |
| prompt-engine | `domains/ai/prompt-engine` | `lib/agent/formatReply`, `utils/rahhalVoice` |
| safety | `domains/ai/safety` | `lib/ops/security` |
| evaluation | `domains/ai/evaluation` | `lib/ai/analytics` |
| conversation-state | `domains/ai/conversation-state` | chat/brain state surfaces |

## Leaf type modules (cycle-safe)

| Module | Purpose |
|--------|---------|
| `utils/travelSessionTypes.ts` | `TravelSession` + session enums |
| `utils/providerSearchResult.ts` | Provider search DTOs |
| `lib/brain/integrationTypes.ts` | `RunIntegratedBrainTurnInput` |
| `lib/brain/orchestrator/reset.ts` | Orchestrator reset without integration import |
| `lib/brain/orchestrator/sessionRegistry.ts` | Handle registry |

## Intentionally dual packages (documented)

| Pair | Notes |
|------|-------|
| `lib/payment` vs `lib/payments` | Hosted checkout vs Sprint 34 platform — both under `domains/payments` |
| `lib/execution` vs `lib/brain/execution` | Booking execution vs search-task execution |
| `lib/chat/voice` vs `lib/voiceConversation` | Production chat voice vs Sprint 18 foundation (flag OFF) |
| `lib/aiOrchestrator` vs `lib/brain/orchestrator` | Sprint 43 vs Sprint 27 — flag-gated |

Physical consolidation is tracked in `TECHNICAL_DEBT.md` / `ROADMAP_TECHNICAL.md`.
