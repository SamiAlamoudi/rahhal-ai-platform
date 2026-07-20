# Domains

Domain-driven scaffolding for Rahhal. These folders are **compatibility shims**: they re-export existing implementations from `src/lib/*`, `src/utils/*`, and `src/integrations/*` without moving code or changing runtime behavior.

## Domain map

| Domain | Responsibility (summary) |
| --- | --- |
| `ai` | Agent, orchestration, concierge, and AI enhancement surface (plus AI sub-modules) |
| `conversation` | Chat engine, travel brain, travel session state |
| `voice` | Voice conversation and chat voice providers/session |
| `booking` | Booking flows, confirmation, orders, passengers |
| `flights` | Flight results and Amadeus provider integration |
| `hotels` | Hotels search/adapters and Booking.com provider |
| `payments` | Checkout/payment stacks (`lib/payment` + `lib/payments`) |
| `auth` | Authentication helpers |
| `notifications` | In-app notification APIs |
| `shared` | Shared contracts and DB row types (leaf-safe) |
| `core` | Search/decision/reasoning engines, trips, execution |
| `infrastructure` | Integrations, ops, repositories, Supabase client |

## Dependency rule

1. **Domains may depend on** `shared`, `core`, and `infrastructure` (and their existing lib/utils/integrations sources).
2. **UI** (`pages`, `components`) **may depend on domains** (preferred over deep `lib/` imports going forward).
3. **`core` must never depend on** `pages` or `components`.
4. **No circular domain dependencies** — enforce with `npm run arch:circular`.

Cross-domain imports between feature domains (e.g. `booking` → `payments`) should go through public `index.ts` barrels only, not deep sibling paths, once migration begins.

## Migration note

Implementations still live under `src/lib`, `src/utils`, and `src/integrations`. Domain barrels are the public façade; physical moves come later.
