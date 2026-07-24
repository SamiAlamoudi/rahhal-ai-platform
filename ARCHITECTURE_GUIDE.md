# Architecture Guide — Rahhal AI Platform

**Audience:** engineers extending Rahhal without breaking ownership boundaries.  
**Version:** aligned with `1.1.0-rc.1` + Recovery Phase 1 + engineering audit.  
**Invariant:** no product behavior change in architecture/cleanup PRs.

## Goals

1. Clear **package ownership** under `src/lib` / `src/core`.
2. **Acyclic** dependency graph (`npm run arch:circular`).
3. **AI layer** isolatable (providers / memory / planning / tools / reasoning / safety).
4. Features independently **flag-gated and removable**.
5. Core engines never depend on UI.

## Layered model

```
┌─────────────────────────────────────────────┐
│  UI  (src/pages, src/components, src/hooks) │
└───────────────────┬─────────────────────────┘
                    │ depends on
┌───────────────────▼─────────────────────────┐
│  Product packages (src/lib/*)               │
│  agent · chat · concierge · payment · …     │
└───────┬──────────────────────────┬──────────┘
        │                          │
┌───────▼────────┐        ┌────────▼──────────┐
│ Sprint engines │        │ integrations /    │
│ (src/core/*)   │        │ utils / repos     │
└────────────────┘        └───────────────────┘
```

Former `src/domains/*` façades were unused and removed (engineering audit). Do not reintroduce empty re-export trees without real consumers.

## Dependency rules

| From → To | Allowed? |
|-----------|----------|
| UI → `lib` / `utils` / `integrations` | Yes |
| `lib` → `core` / `integrations` / leaf utils | Yes |
| `core` → pages/components | **Never** |
| integrations → UI | **Never** |
| utils leaf types → orchestrators | **Never** (types flow down) |

Enforce cycles with:

```bash
npm run arch:circular
```

## Catalogue

See [`MODULE_MAP.md`](MODULE_MAP.md).

## AI sub-architecture (active packages)

| Concern | Package |
|---------|---------|
| Turn owner | `lib/agent/travelAgentService` (`planTurn`) |
| Memory | `lib/agent/memory.ts` |
| Decision / concierge policy | `lib/concierge` |
| Planning estimates | `lib/agent/planningDraft` |
| Conversation language | `lib/agent/conversationBrain` |
| Smart clarification | `lib/agent/clarification` |
| Travel reasoning catalog | `lib/agent/reasoning` |
| RahhalBrain enricher | `lib/brain` |
| Feature flags | `lib/ai/featureFlags` |

## Feature isolation

Product features are gated by `FeatureRegistry` (`src/lib/ai/featureFlags`).  
Experimental Sprint engines default **OFF**. Removing a feature should mean:

1. Disable/remove its flag.
2. Stop importing it from the production spine.
3. Keep shared contracts intact.

## Adding code

1. Place new logic in the owning `src/lib/<package>` (or `src/core` for shared engines).
2. Prefer leaf type modules over fat barrels for cross-package types.
3. Add/adjust tests under `src/lib/__tests__`.
4. Run `npm run lint && npm run typecheck && npm run test:run && npm run arch:circular`.

## Related

- [`MODULE_MAP.md`](MODULE_MAP.md)
- [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md)
- [`RECOVERY_PHASE_1_REPORT.md`](RECOVERY_PHASE_1_REPORT.md)
- [`ENGINEERING_AUDIT_REPORT.md`](ENGINEERING_AUDIT_REPORT.md)
