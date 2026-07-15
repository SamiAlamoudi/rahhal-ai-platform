# Staging Smoke Test — v1.0.0-rc1

Repeatable smoke checklist for a controlled staging environment.

## Automated (CI / local)

```bash
npm run test:smoke
# or
npm run test:rc1
```

The Vitest suite `src/lib/__tests__/rc1.stagingSmoke.test.ts` verifies:

- [x] App module surface loads
- [x] Auth contract works (mocked Supabase)
- [x] Database client env contract present
- [x] Health / readiness / liveness library probes pass with mock payment
- [x] Mock payment remains active
- [x] Live providers remain off unless explicitly enabled
- [x] Environment validation fails safely for live payment / client secrets
- [x] Env examples keep `VITE_PAYMENT_PROVIDER=mock`
- [x] Security headers, PII masking, rate limits active
- [x] Core journey slice (mock search + booking payment start)

Also run:

```bash
bash scripts/secret-hygiene-scan.sh
```

## Deployed staging host (manual)

Pre-deploy: follow `docs/STAGING_CHECKLIST.md`.

| # | Check | Pass? | Evidence |
|---|-------|-------|----------|
| 1 | App loads (SPA boots, no console secret leaks) | | |
| 2 | Auth works (sign-in / sign-out on staging Supabase) | | |
| 3 | Database access works (profile/preferences read-write) | | |
| 4 | Edge Functions respond (`amadeus-token`, proxies, `ops-health`) | | |
| 5 | Health endpoint passes (`/health.json` and/or `ops-health?probe=live`) | | |
| 6 | Readiness endpoint passes (`ops-health?probe=ready`, payment mock safe) | | |
| 7 | Mock payment remains active (`VITE_PAYMENT_PROVIDER=mock`) | | |
| 8 | Live providers remain off unless explicitly enabled | | |
| 9 | No client bundle contains secrets (network/source inspect) | | |
| 10 | Core user journey completes (search → book → mock pay → ticket → My Trips) | | |

## Sign-off

- Engineer: __________________ date: __________
- Commit SHA: ________________
- Staging URL: ________________
