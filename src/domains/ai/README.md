# ai

## Responsibilities

AI travel agent, orchestration, concierge helpers, and Phase AB AI enhancement (preferences, ranking, planning analytics). Sub-modules under this folder refine the AI surface (providers, memory, planning, tools, etc.).

## Public API

Re-exports from:

- `src/lib/ai`
- `src/lib/agent`
- `src/lib/aiOrchestrator`
- `src/lib/concierge`

See also sub-modules: `providers`, `models`, `memory`, `planning`, `tool-calling`, `reasoning`, `prompt-engine`, `safety`, `evaluation`, `conversation-state`.

## Dependencies

May use `shared`, `core`, and `infrastructure`. Must not import UI (`pages` / `components`).

## Rules

- Compatibility shim only — do not move implementations here yet.
- Prefer importing from this barrel (or a sub-module) instead of deep `lib/agent` paths in new code.
- No circular imports with other feature domains.
