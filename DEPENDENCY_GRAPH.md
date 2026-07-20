# Dependency Graph

## Enforcement

```bash
npm run arch:circular   # zero-dep cycle detector — must report 0 cycles
```

Status after architecture DDD pass: **0 circular dependencies** under `src/`.

## Target dependency direction

```mermaid
flowchart TB
  UI[pages / components / hooks]
  D_AI[domains/ai]
  D_CONV[domains/conversation]
  D_VOICE[domains/voice]
  D_BOOK[domains/booking]
  D_FLIGHT[domains/flights]
  D_HOTEL[domains/hotels]
  D_PAY[domains/payments]
  D_AUTH[domains/auth]
  D_NOTIF[domains/notifications]
  SHARED[domains/shared]
  CORE[domains/core]
  INFRA[domains/infrastructure]

  UI --> D_AI
  UI --> D_CONV
  UI --> D_VOICE
  UI --> D_BOOK
  UI --> D_FLIGHT
  UI --> D_HOTEL
  UI --> D_PAY
  UI --> D_AUTH
  UI --> D_NOTIF

  D_AI --> SHARED
  D_AI --> CORE
  D_CONV --> SHARED
  D_CONV --> CORE
  D_BOOK --> SHARED
  D_PAY --> SHARED
  D_FLIGHT --> INFRA
  D_HOTEL --> INFRA
  CORE --> SHARED
  CORE --> INFRA
  D_AI --> INFRA
```

## Forbidden edges

- `core` → `pages` / `components`
- `infrastructure` → UI
- Feature domain → another feature’s **private** files (use public `index.ts` only)
- Adapter/mock modules → fat `utils/contracts` barrel (use leaf `providers` / `models` / `result`)
- Orchestrator types → `brain/integration.ts` (use `integrationTypes.ts`)

## Historical cycles (resolved)

| Former cycle | Resolution |
|--------------|------------|
| `travelSession` ↔ `requirementAnalyzer` | `travelSessionTypes.ts` leaf |
| `searchOrchestrator` ↔ mocks ↔ `toSearchResult` | `providerSearchResult.ts` leaf |
| contracts barrel ↔ integrations registry | Adapters/mocks import leaf contract paths |
| `bookingFlow` ↔ `brain` barrel | Deep imports + conversationMemory leaf |
| `integration` ↔ `aiTripOrchestrator` | `integrationTypes`, `orchestrator/reset`, `sessionRegistry` |

## Runtime vs façade

UI may still import `src/lib/*` directly during migration. New code should prefer `src/domains/<domain>`. Façades re-export implementations; they do not duplicate logic.
