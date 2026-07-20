# conversation

## Responsibilities

Text chat engine/UI state, travel brain orchestration, and travel session intake used by conversation flows.

## Public API

- `src/lib/chat` — chat engine, services, conversation experience
- `src/lib/brain` — travel brain public API (orchestrator, memory, planners)
- `travelSession` namespace — `src/utils/travelSession` (namespaced to avoid `CabinClass` / `VisaStatus` clashes with brain)

## Dependencies

May use `shared`, `core`, `infrastructure`, and `ai` sub-surfaces via their barrels. Must not import UI.

## Rules

- Brain is large; prefer its package `index.ts` entry points only.
- `travelSession` is re-exported as a namespace to keep the barrel type-safe.
- Compatibility shim only — implementations stay in lib/utils.
