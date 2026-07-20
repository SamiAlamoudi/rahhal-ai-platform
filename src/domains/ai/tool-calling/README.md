# ai/tool-calling

## Responsibilities

Agent tool registry, stubs, executor, selection, and merge helpers.

## Public API

Named exports from `src/lib/agent/tools/*` (`tools` has no package `index.ts`).

## Dependencies

Agent aggregation providers. No UI.

## Rules

- No `src/lib/agent/tools/index.ts` yet — this barrel is the public façade.
- Compatibility shim only.
