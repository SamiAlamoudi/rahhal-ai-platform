# Sprint 72 — Flight Search Engine (Production Ready)

Production-grade flight search on top of the Sprint 71 Provider Runtime.

**Additive only.** Does not rewrite architecture, RahhalBrain, or Provider Runtime behavior.

## Summary

`src/lib/agent/flightSearchEngine/` normalizes requests, fans out to Amadeus / Duffel via Provider Runtime (parallel), falls back to mock, merges/normalizes/dedupes/ranks/filters/sorts/paginates, and returns a unified flight page with diagnostics.

## Search pipeline

```
Normalize Request
  → Provider Runtime (parallel Amadeus + Duffel)
  → Mock Provider (automatic fallback)
  → Merge Results
  → Normalize (UnifiedFlight)
  → Deduplicate
  → Rank
  → Filter / Sort
  → Cursor Pagination
  → Return + Diagnostics
```

## Ranking strategy

Weighted score:

| Factor | Weight |
|--------|--------|
| Lowest price | 0.30 |
| Shortest duration | 0.20 |
| Fewest stops | 0.20 |
| Preferred airline | 0.10 |
| Provider confidence | 0.10 |
| Result completeness | 0.10 |

## Files created

- `src/lib/agent/flightSearchEngine/*`
- `src/lib/__tests__/flightSearch.sprint72.test.ts`
- `docs/SPRINT72_FLIGHT_SEARCH_ENGINE.md`

## Files modified

- `src/lib/agent/index.ts`
- `package.json` (`flights:verify`)
- `.env.example`

## Architecture impact

- Consumer of Provider Runtime only
- Existing `liveProviders`, BI, Booking Execution, RahhalBrain unchanged
- No breaking API changes

## Tests added

`npm run flights:verify` — search, one-way, round-trip, multi-city, ranking, dedupe, filters, sorting, pagination, diagnostics, mock/live modes, failover

## Validation

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run arch:circular
```

## Known limitations

- Live Amadeus/Duffel still require feature flags + Edge secrets (defaults mock)
- Multi-city attaches leg metadata; deep multi-segment offer expansion is future work
- Cache hit flag reserved (always false in this sprint; SmartCache remains in liveProviders)
- Round-trip does not yet price a separate inbound offer object

## Performance notes

- Parallel provider fan-out by default
- Per-provider timeout (`timeoutMs`, default 8s)
- Reuses Provider Runtime retry + circuit breaker
- Cursor pagination avoids re-querying providers for page turns within a result set
