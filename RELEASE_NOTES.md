# Release Notes — Rahhal AI Platform v1.0.1

**Status:** Patch release candidate (tooling / CI)  
**Date:** 2026-07-16  
**Previous stable:** `v1.0.0`  
**Payment mode:** `VITE_PAYMENT_PROVIDER=mock` (unchanged — live payments disabled)  
**Live travel providers:** OFF by default (unchanged)

## Summary

Rahhal **v1.0.1** is a minimal patch release that restores the `providers:check` npm command and CI quality gate after it was missing from the published `v1.0.0` tree. The functional application surface is unchanged from `v1.0.0`.

## What changed

- Restores `npm run providers:check` (config/readiness validation only; no network by default).
- Runs **Providers check** explicitly in GitHub Actions after unit tests and before build.
- Tightens provider environment validation exit criteria (`validateEnvironment.ok` required).
- Adds failure-path coverage for:
  - non-mock payment provider
  - forbidden client-side secret env keys

## What did not change

- No new application features
- No UI redesign or project rename
- No public API or database contract changes
- Live travel providers remain **disabled by default**
- Payment behavior remains **mock-only**
- No secrets added, exposed, rotated, or modified

## How to validate

```bash
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run providers:check
npm run build
npm run test:smoke   # existing staging smoke suite (optional for this patch)
```

See `V1_0_1_TEST_REPORT.md` for executed results.

## Deploy notes

- Safe to deploy over `v1.0.0` with no migration required.
- Keep staging/production env templates derived from `.env.*.example` with:
  - `VITE_PAYMENT_PROVIDER=mock`
  - `VITE_LIVE_PROVIDERS_ENABLED=false`

## Approval gate

Do **not** tag or publish `v1.0.1` until:

1. This PR’s CI Quality gates are green (including Providers check)
2. Explicit human approval is granted for merge
3. Explicit human approval is granted for tagging/publishing
