# Sprint 73 — Hotel Search Engine (Production Ready)

Production-grade hotel search on top of the Sprint 71 Provider Runtime.

**Additive only.** Does not rewrite architecture, RahhalBrain, Flight Search Engine, or Provider Runtime internals.

## Summary

`src/lib/agent/hotelSearchEngine/` normalizes requests, fans out to Booking.com via Provider Runtime (parallel), probes future-ready Hotelbeds (empty), falls back to mock, then merges/normalizes/dedupes/ranks/filters/sorts/paginates with diagnostics.

## Search pipeline

```
Normalize Request
  → Provider Runtime (Booking.com)
  → Hotelbeds (future-ready, empty)
  → Mock Provider (automatic fallback)
  → Merge
  → Normalize (UnifiedHotel)
  → Deduplicate
  → Rank
  → Filter / Sort
  → Cursor Pagination
  → Return + Diagnostics
```

## Ranking

| Factor | Weight |
|--------|--------|
| Price | 0.25 |
| Rating | 0.20 |
| Distance | 0.15 |
| Reviews | 0.10 |
| Stars | 0.10 |
| Amenities | 0.10 |
| Provider confidence | 0.10 |

## Files created

- `src/lib/agent/hotelSearchEngine/*`
- `src/lib/__tests__/hotelSearch.sprint73.test.ts`
- `docs/SPRINT73_HOTEL_SEARCH_ENGINE.md`

## Files modified

- `src/lib/agent/index.ts`
- `package.json` (`hotels:verify`)
- `.env.example`

## Architecture impact

- Consumer of Provider Runtime only
- Flight Search Engine untouched
- Hotelbeds is engine-local future stub (no runtime ID changes)

## Tests

`npm run hotels:verify` — search, city, by-id, nearby, ranking, dedupe, filters, sorting, pagination, diagnostics, mock/live modes, failover

## Validation

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run arch:circular
```

## Known limitations

- Live Booking.com still requires feature flags + Edge secrets (defaults mock)
- Hotelbeds returns empty until a live adapter is registered
- Cache hit flag reserved (`false` this sprint)
- `searchHotelById` synthesizes a match when providers lack exact id coverage in mock mode

## Performance

- Parallel Booking.com + Hotelbeds future probe
- Per-provider timeout (default 8s)
- Reuses Provider Runtime retry + circuit breaker
- Cursor pagination over in-memory ranked set
