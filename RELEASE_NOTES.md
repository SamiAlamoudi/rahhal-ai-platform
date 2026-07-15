# Release Notes — v1.0.0-rc1

**Status:** Release Candidate  
**Date:** 2026-07-15  
**Codename:** Phase Y — Release Candidate RC1

## Summary

Rahhal `v1.0.0-rc1` packages the completed roadmap through Phase X (production hardening) into a controlled staging candidate. This build is intended for staging validation only. It does **not** enable live payments or live travel providers by default.

## What is included

- Conversation-driven trip planning (text + voice polish)
- Intelligent trip intake → TripPlan generation
- Provider aggregation with mock fallback (Amadeus / Booking.com / Maps / Weather adapters)
- Decision scoring enrichment
- Booking session → mock checkout → mock ticketing → mock notifications
- My Trips management (save, duplicate, cancel, timeline/audit)
- Ops hardening: health/readiness, env validation, security headers, PII masking, rate limits, dead-letter utilities

## Safe defaults (do not change for RC1)

| Setting | Required value |
|---------|----------------|
| `VITE_PAYMENT_PROVIDER` | `mock` |
| `VITE_LIVE_PROVIDERS_ENABLED` | `false` |
| Mock provider fallback | on |

## How to validate

```bash
npm ci
npm run test:rc1      # journey + failure paths + staging smoke
npm run test:run      # full unit suite
npm run typecheck
npm run lint
npm run build
```

Follow `STAGING_SMOKE_TEST.md` on a real staging host after deploy.

## Not in this candidate

- Final production tag `v1.0.0`
- Live Moyasar payments
- Default-on live travel providers
- Browser Playwright/Cypress suite (library E2E used for RC1)

## Approval gate

Stop before tagging or releasing RC1 until human approval is given. See `RELEASE_BLOCKERS.md` and `RC1_TEST_REPORT.md`.
