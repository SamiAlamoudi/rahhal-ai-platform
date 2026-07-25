# NEW_UX_AUDIT — Product Sprint A

**Mode:** Product audit before/after foundation  
**Flag:** `ui.new_experience` (default **OFF**)

## Screens preserved (rollback path)

| Screen | Route | Notes |
|--------|-------|-------|
| AiHomeExperience | `/` when flag OFF + `ui.ai_home` | Conversation-first home (Recovery) |
| LegacyHome | `/` when both off | Older home |
| LegacyChatPage | `/chat` | Sole chat spine / engine |
| My Trips / Settings / Search | existing | Functionality retained |
| Auth Login / SignUp / Forgot | auth routes | Shared brand polish (no engine change) |

## Screens redesigned (flag ON)

| Surface | Change |
|---------|--------|
| Home | `NewHomeExperience` — brand hero, composer, suggestions, recent trips |
| Chat chrome | `ProductAppBar`, voice state badge, sticky composer, suggested replies |
| Chat results | Progressive flight/hotel/budget/itinerary/confirmation cards |
| My Trips / Settings | `ProductPageShell` + travel preferences panel |

## Duplicate / obsolete UI

| Item | Decision |
|------|----------|
| `src/ui/*` production-integration stack | Remains quarantined (Recovery freeze) — not resurrected |
| Sprint 119/121 tokens | Reused conceptually; Sprint A tokens live in `src/lib/productUx` without a second framework |
| Traditional booking form as home CTA | Not used in new home |

## Reusable components

- `ConversationComposer`, `ChatWelcome`, `MessageBubble`, chatEngine spine
- Normalized `FlightCardModel` / `HotelCardModel` / budget `CostBreakdown`
- Framer Motion (already in stack), Cairo/Tajawal fonts

## Missing states addressed

First use, no trips, no results, provider unavailable, weak network, offline, session expired, auth required, permission denied, microphone unavailable, location unavailable, loading, error — via `ProductStatePanel`.

## Disconnected engine outputs

Structured conversation meta still only appears when upstream flags produce it. Sprint A bridge falls back to seed-based presentation cards so the UI demonstrates progressive disclosure without new providers.
