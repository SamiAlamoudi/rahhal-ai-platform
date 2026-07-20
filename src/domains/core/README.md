# core

## Responsibilities

Search orchestration, live search, decision scoring, reasoning, trip domain services, and execution engine.

## Public API

- `src/utils/searchOrchestrator`
- `src/utils/liveSearchOrchestrator`
- `src/utils/decisionScoreEngine`
- `src/utils/reasoningEngine`
- `src/lib/trips`
- `src/lib/execution`

## Dependencies

May use `shared` and `infrastructure`. **Must never depend on** `pages` or `components`.

## Rules

- Core is importable by feature domains and UI; not the reverse into UI.
- Compatibility shim only.
