# Release Notes — v1.0.0-rc1

**Status:** Release Candidate (staging validation only)  
**Date:** 2026-07-15  
**Payment mode:** `VITE_PAYMENT_PROVIDER=mock` (live payments disabled)  
**Live travel providers:** OFF by default

## What this RC includes

Rahhal `v1.0.0-rc1` freezes product features and focuses on release readiness:

- Full library-style E2E coverage of the core user journey
- Failure-path and resilience verification
- Repeatable staging smoke suite
- Release blocker checklist, known issues, rollback plan
- Security verification for mock payment, secret hygiene, headers, masking, and rate limits

## What is intentionally not included

- Final production tag `v1.0.0`
- Live payment provider enablement
- Live Amadeus / Booking.com / Maps / Weather by default
- UI redesign or project rename
- New product features beyond bug/test/doc hardening

## How to validate

```bash
npm run test:rc1      # RC1 e2e + failure + smoke
npm run test:run      # full unit/integration suite
npm run typecheck
npm run lint
npm run build
bash scripts/secret-hygiene-scan.sh
```

Follow `STAGING_SMOKE_TEST.md` on a staging host before any production consideration.

## Approval gate

Do **not** tag or release RC1 until:

1. CI quality gates are green
2. Staging smoke is signed off
3. No Blocker/Critical items remain in `RELEASE_BLOCKERS.md`
4. Explicit human approval is granted
