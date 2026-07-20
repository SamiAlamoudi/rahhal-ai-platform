# Architecture Guide — Rahhal AI Platform

**Audience:** engineers extending Rahhal without breaking domain boundaries.  
**Version:** aligned with `1.1.0-rc.1` + architecture DDD pass.  
**Invariant:** no feature work in architecture PRs; behavior preserved via re-exports.

## Goals

1. Clear **domain ownership** (DDD-inspired).
2. **Acyclic** dependency graph (`npm run arch:circular`).
3. **AI layer** isolatable into providers / memory / planning / tools / reasoning / safety / evaluation / conversation-state.
4. Features independently **flag-gated and removable**.
5. Core never depends on UI.

## Layered model

```
┌─────────────────────────────────────────────┐
│  UI  (src/pages, src/components, src/hooks) │
└───────────────────┬─────────────────────────┘
                    │ depends on
┌───────────────────▼─────────────────────────┐
│  Domains  (src/domains/*)  public façades   │
└───────┬──────────────────────────┬──────────┘
        │                          │
┌───────▼────────┐        ┌────────▼──────────┐
│ Feature domains│        │ shared / core /   │
│ ai conversation│        │ infrastructure    │
│ voice booking… │        └────────┬──────────┘
└───────┬────────┘                 │
        │                          │
┌───────▼──────────────────────────▼──────────┐
│  Implementations (src/lib, utils,           │
│  integrations) — migrate behind domains     │
└─────────────────────────────────────────────┘
```

## Dependency rules

| From → To | Allowed? |
|-----------|----------|
| UI → domains | Yes (preferred) |
| UI → lib/utils (legacy) | Tolerated during migration |
| Domain → shared/core/infrastructure | Yes |
| Domain → other feature domain | Only via that domain’s `index.ts` |
| core → pages/components | **Never** |
| infrastructure → UI | **Never** |
| utils leaf types → orchestrators | **Never** (types flow down) |

Enforce cycles with:

```bash
npm run arch:circular
```

## Domain catalogue

See [`src/domains/README.md`](src/domains/README.md) and [`MODULE_MAP.md`](MODULE_MAP.md).

## AI sub-architecture

Under `src/domains/ai/`:

| Module | Responsibility |
|--------|----------------|
| `providers` | Provider adapters / aggregation ports |
| `models` | TripPlan, requirements, LLM port types |
| `memory` | Agent + brain conversation memory |
| `planning` | Itinerary / trip planning helpers |
| `tool-calling` | Tool registry + executor |
| `reasoning` | Decision / scoring / explanations |
| `prompt-engine` | Reply formatting / persona text |
| `safety` | Security / env / media URL guards |
| `evaluation` | Analytics / quality signals |
| `conversation-state` | Chat/brain turn state shapes |

Each module has `README.md` (Responsibilities, Public API, Dependencies, Rules) and `index.ts`.

## Feature isolation

Product features are gated by `FeatureRegistry` (`src/lib/ai/featureFlags`).  
Experimental Sprint engines default **OFF**. Removing a feature should mean:

1. Disable/remove its flag.
2. Stop importing its domain barrel from UI.
3. Keep shared contracts intact.

Do **not** reach into another feature’s private files.

## Folder standardization

**Canonical public entry:** `src/domains/<domain>/index.ts`  
**Ownership docs:** every domain folder has `README.md`.  
**Legacy paths** (`src/lib/*`, `src/utils/*`) remain as implementation homes until physical moves; they must not gain new cross-cycles.

## Adding code

1. Place new logic in the owning domain’s implementation package (`lib/...`).
2. Export only what UI needs through `src/domains/<domain>/index.ts`.
3. Prefer leaf type modules over fat barrels for cross-package types.
4. Run `npm run typecheck && npm run arch:circular && npm run test:run`.

## Related docs

- [`MODULE_MAP.md`](MODULE_MAP.md)
- [`DEPENDENCY_GRAPH.md`](DEPENDENCY_GRAPH.md)
- [`SYSTEM_OVERVIEW.md`](SYSTEM_OVERVIEW.md)
- [`ROADMAP_TECHNICAL.md`](ROADMAP_TECHNICAL.md)
- [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md)
- [`ARCHITECTURE_METRICS.md`](ARCHITECTURE_METRICS.md)
- [`AI_ARCHITECTURE.md`](AI_ARCHITECTURE.md)
- [`FEATURE_REGISTRY.md`](FEATURE_REGISTRY.md)
