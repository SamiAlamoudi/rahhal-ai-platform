# Sprint 71 — Live Provider Integration Framework

Provider **runtime** layer for real-world travel provider integration.

**Additive only.** Extends existing Live Provider SDK adapters. Does **not** rewrite RahhalBrain, Booking Intelligence, or Booking Execution.

## Module

`src/lib/agent/providerRuntime/`

| Concern | API |
|---------|-----|
| Unified adapter | `initialize`, `authenticate`, `health`, `capabilities`, `search`, `book`, `cancel`, `refresh` |
| Adapters | Amadeus / Duffel / Booking.com / mock (feature-flag + secret gated) |
| Registry | `getProvider`, `getAvailableProviders`, `getHealthyProviders`, `getPreferredProvider` |
| Failover | primary → secondary → mock → graceful Arabic message |
| Retry | exponential backoff + timeout + circuit breaker |
| Secrets | `validateProviderSecrets` — presence only, never values |

## Architecture impact

- Wraps `createAmadeusLiveProvider` / `createDuffelLiveProvider` / `createBookingLiveProvider`
- Reuses Phase W `createCircuitBreaker`
- Existing `liveProviders` Sprint 56–61 APIs unchanged
- BI / Booking Execution continue to use existing bridges

## Files created

- `src/lib/agent/providerRuntime/*`
- `src/lib/__tests__/providerRuntime.sprint71.test.ts`
- `docs/SPRINT71_PROVIDER_RUNTIME.md`

## Files modified

- `src/lib/agent/index.ts` (re-exports)
- `package.json` (`runtime:verify`)
- `.env.example`

## Tests

`npm run runtime:verify` — registration, auth, failover, retries, health, diagnostics, registry, mock switching, feature flags.

## Validation

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Known limitations

- Live mode still requires feature flags + Edge secrets (defaults remain mock)
- Runtime does not replace BI ranking or Conversation Brain authorship
- Quota tracking is local counter-based (not supplier quota APIs)
- Graceful traveler message is a structured string for Brain to author/adapt
