# Module map (post engineering audit)

Canonical map of Rahhal modules after Recovery Phase 1 + engineering cleanup.
**Implementation source of truth is `src/lib/*`** (plus `src/utils`, `src/integrations`, `src/core` for sprint engines).

Former `src/domains/*` DDD façades were unused (zero importers) and removed in the engineering audit.
New code should import from the owning `src/lib/<package>` (or `src/core` when that is the real engine).

## Top-level layout

| Path | Role |
|------|------|
| `src/lib/` | Product implementations (agent, chat, concierge, payment, …) |
| `src/core/` | Sprint engines re-exported/wrapped by `lib/agent/*` |
| `src/pages/`, `src/components/` | UI routes and views |
| `src/integrations/` | External provider clients |
| `src/utils/` | Shared session/search helpers |
| `archive/` | Quarantined unused UI/hooks (Recovery Phase 1) — outside product tree |
| `docs/` | Living docs + `docs/history/` for point-in-time reports |

## Production spine (do not fork)

| Concern | Active choice |
|---------|---------------|
| Conversation | `/chat` → `chatEngine` → `travel-agent` → `travelAgentService.planTurn` |
| Memory | `src/lib/agent/memory.ts` |
| Concierge policy | `src/lib/concierge` (Decision Engine + turn policy) |
| Planning estimates | `src/lib/agent/planningDraft` |
| Conversation language | `src/lib/agent/conversationBrain` |
| Payment | `src/lib/payment` |
| Search form | `/search` → `SearchWorkspace` (not chat SoT) |

## Domain ownership (by package)

| Concern | Primary packages |
|---------|------------------|
| AI / agent | `lib/agent`, `lib/ai`, `lib/concierge`, `lib/brain` |
| Conversation / chat | `lib/chat` |
| Voice input | `lib/chat/voice` |
| Booking | `lib/booking`, `lib/bookingFlow`, `lib/bookingConfirmation`, `lib/orderManagement`, `lib/passengers` |
| Flights | `lib/flightResults`, `integrations/providers/amadeus` |
| Hotels | `lib/hotels`, `integrations/providers/booking` |
| Payments | `lib/payment` (SoT); `lib/payments` quarantined |
| Auth | `lib/auth` |
| Notifications | `lib/notifications` |
| Ops / infra | `lib/ops`, `lib/repositories`, `integrations` |

## Quarantined (keep for tests; not product-selected)

See `archive/QUARANTINE.md` and `src/lib/recovery/freeze.ts`.
