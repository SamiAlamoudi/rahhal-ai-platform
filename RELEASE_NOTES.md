# Release Notes — Rahhal AI Platform v1.0.0

**Status:** Stable production release  
**Date:** 2026-07-15  
**Promoted from:** `v1.0.0-rc1` (validated)  
**Payment mode:** `VITE_PAYMENT_PROVIDER=mock` (live payments disabled)  
**Live travel providers:** OFF by default

## Highlights

Rahhal AI Platform **v1.0.0** is the first stable release. It promotes the successfully validated release candidate after RC1 exit criteria were met:

- Core user journey covered end-to-end (auth, chat/voice, trip planning, search, decision scoring, My Trips, mock booking/payment/ticketing/notifications)
- Failure-path and resilience coverage (timeouts, rate limits, circuit breaker, mock fallback, retries, DLQ, unauthorized access, session expiry, voice permission/interrupt)
- Staging smoke suite for health/readiness, mock payment, live-provider defaults, env validation, and secret hygiene
- Production-hardening ops layer (masking, security headers, rate limits, readiness probes)
- Documented rollback plan and known issues

## Product posture (v1.0.0)

- Mock payment is the only enabled payment mode
- Live Amadeus / Booking.com / Maps / Weather providers remain **disabled by default**
- No project rename; public APIs and database contracts preserved from RC1

## Validation evidence

RC1 gates that justified promotion (see also `RC1_TEST_REPORT.md`):

| Check | Result |
|-------|--------|
| `npm run test:rc1` | PASS |
| `npm run test:run` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Secret hygiene scan | PASS |
| CI Quality gates on PR #40 | PASS |

## Upgrade / deploy notes

1. Deploy from tag `v1.0.0`
2. Keep `VITE_PAYMENT_PROVIDER=mock`
3. Keep `VITE_LIVE_PROVIDERS_ENABLED=false` unless an explicitly approved live-provider pilot is configured with server-side secrets
4. Run staging readiness (`ops-health` / `/health.json`) before production traffic
5. Keep `ROLLBACK_PLAN.md` nearby for incident response

## Intentionally deferred

- Live payment provider enablement (see `docs/PAYMENT_PRODUCTION_TODO.md`)
- Default-on live travel providers
- Browser Playwright/Cypress harness (documented in `KNOWN_ISSUES.md`)

## Artifacts

- `CHANGELOG.md`
- `RELEASE_NOTES.md` (this file)
- `RC1_TEST_REPORT.md`
- `KNOWN_ISSUES.md`
- `ROLLBACK_PLAN.md`
