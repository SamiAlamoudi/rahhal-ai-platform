# ai/providers

## Responsibilities

Agent provider adapters and aggregation vendor providers (Amadeus, Booking, Maps, Weather).

## Public API

- `src/lib/agent/providers` (facade over aggregation)
- Vendor barrels under `src/lib/agent/aggregation/providers/*` (no package-level index for `aggregation/providers`)

## Dependencies

`shared`, `infrastructure`, parent `ai` surfaces. No UI.

## Rules

- `aggregation/providers` has no root `index.ts`; vendor subfolders are re-exported explicitly.
- Compatibility shim only.
