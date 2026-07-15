# Staging Smoke Test — v1.0.0-rc1

Repeatable smoke checklist for a staging deploy of Rahhal RC1.

## Prerequisites

- Staging host deployed from the RC1 commit SHA
- `.env` derived from `.env.staging.example`
- `VITE_PAYMENT_PROVIDER=mock`
- `VITE_LIVE_PROVIDERS_ENABLED=false`
- Supabase staging URL + anon key configured
- Edge Functions deployed: `ops-health`, provider proxies (optional for mock-only)

## Automated (local / CI mirror)

```bash
npm run test:smoke
```

This verifies:

1. Static `/public/health.json` and `/public/ready.json`
2. Library liveness / readiness / health for staging + mock payment
3. `ops-health` Edge Function source probes
4. Mock payment remains active in env templates + test env
5. Live providers remain OFF unless explicitly enabled
6. Env validation fails safely on leaked `VITE_*` secrets / live payment
7. Security headers present (`SECURITY_HEADERS` + `public/_headers`)
8. PII masking active
9. Domain rate limits active
10. No forbidden client secret assignments in env templates
11. Startup succeeds under safe defaults
12. Compressed core journey: plan → mock book → pay → ticket

## Manual staging host checks

| # | Check | Pass criteria |
|---|--------|---------------|
| 1 | App loads | SPA boots without console secret leaks |
| 2 | Auth works | Sign-in / sign-out against staging Supabase |
| 3 | Database access | Protected routes load user-owned data via RLS |
| 4 | Edge Functions respond | `ops-health?probe=live` → 200 |
| 5 | Health endpoint | `/health.json` → `status: ok` |
| 6 | Readiness endpoint | `ops-health?probe=ready` → 200 and `payment_provider_safe.ok=true` |
| 7 | Mock payment active | Checkout remains mock; no Moyasar live charge |
| 8 | Live providers off | Flight/hotel/maps/weather use mocks unless flags flipped |
| 9 | No secrets in client bundle | Dist has no provider secret values |
| 10 | Core journey | Draft trip → mock pay → ticket → appear in My Trips |

## Sign-off

| Role | Name | Date | SHA |
|------|------|------|-----|
| Engineering | | | |
| Product / ops | | | |

Record results in `RC1_TEST_REPORT.md`.
