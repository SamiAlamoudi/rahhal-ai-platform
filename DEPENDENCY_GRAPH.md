# Dependency Graph

## Enforcement

```bash
npm run arch:circular   # zero-dep cycle detector — must report 0 cycles
```

Status: **0 circular dependencies** under `src/`.

## Target dependency direction

```mermaid
flowchart TB
  UI[pages / components / hooks]
  AGENT[lib/agent]
  CHAT[lib/chat]
  CONCIERGE[lib/concierge]
  PAY[lib/payment]
  CORE[src/core engines]
  INTEG[integrations]
  UTILS[utils]
  REPOS[lib/repositories]

  UI --> AGENT
  UI --> CHAT
  UI --> PAY
  UI --> UTILS

  AGENT --> CONCIERGE
  AGENT --> CORE
  AGENT --> INTEG
  CHAT --> REPOS
  CONCIERGE --> AGENT
  PAY --> REPOS
  CORE --> INTEG
```

## Forbidden edges

- `core` → `pages` / `components`
- `integrations` → UI
- Adapter/mock modules → fat `utils/contracts` barrel (use leaf contract paths)
- Orchestrator types → `brain/integration.ts` (use `integrationTypes.ts`)

## Historical cycles (resolved)

| Former cycle | Resolution |
|--------------|------------|
| `travelSession` ↔ `requirementAnalyzer` | `travelSessionTypes.ts` leaf |
| `searchOrchestrator` ↔ mocks ↔ `toSearchResult` | `providerSearchResult.ts` leaf |
| contracts barrel ↔ integrations registry | Adapters/mocks import leaf contract paths |
| `bookingFlow` ↔ `brain` barrel | Deep imports + conversationMemory leaf |
| `integration` ↔ `aiTripOrchestrator` | `integrationTypes`, `orchestrator/reset`, `sessionRegistry` |

## Notes

- UI imports `src/lib/*` directly (SoT after unused `src/domains` façades were removed).
- Quarantined packages (`lib/payments`, `lib/finance`, …) remain for tests; product routing must not select them — see `src/lib/recovery/freeze.ts`.
