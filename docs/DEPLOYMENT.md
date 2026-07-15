# Deployment (Phase AI)

Controlled deployment guidance for Rahhal. Live payments stay mock; live travel providers stay off until explicitly enabled.

## Prerequisites

1. Follow `docs/STAGING_CHECKLIST.md` and `docs/RELEASE_CHECKLIST.md`
2. Set `VITE_PAYMENT_PROVIDER=mock`
3. Keep `VITE_LIVE_PROVIDERS_ENABLED=false` (and capability flags off)
4. Never place provider secrets in `VITE_*` variables
5. Configure Supabase URL + anon key for auth/persistence

## Boot sequence

```
runStartup()
  → loadAppConfig()
  → validateEnvironment()
  → syncFeatureRegistryFromCapabilities()
  → install global handlers + long-task detector
  → register graceful shutdown hooks
```

SPA entry (`src/main.tsx`) calls `runStartup({ failFast: false })` in development.
Staging/production should use `failFast: true` (default when `VITE_DEPLOY_TARGET` is staging/production).

## Targets

| Target | Fail-fast env | Notes |
|---|---|---|
| `development` | optional | Local Vite |
| `staging` | yes | Mock payment required |
| `production` | yes | Mock payment required until freeze lifts |

## Health probes

- Liveness: `checkLiveness()` / `public/health.json`
- Readiness: `checkReadiness()` — env, payment safety, API, database, queue, cache
- Health: `checkHealth()` — readiness + failure pressure
- Edge: `supabase/functions/ops-health`

## Safe rollout

1. Deploy with all live capability flags OFF (`VITE_LIVE_PROVIDERS_ENABLED=false`, all `VITE_PROVIDERS_*_LIVE=false`)
2. Keep `VITE_PAYMENT_PROVIDER=mock`
3. Verify health/ready probes
4. Run `npm run providers:check` (config-only; expect mock selections)
5. Verify structured logs include correlation IDs
6. Only then consider staged **sandbox** provider enablement (see `docs/LIVE_PROVIDER_ENABLEMENT.md` — separate approval)

## Rollback

Use `ROLLBACK_PLAN.md`. Prefer config rollback (flags OFF, mock payment) before code rollback.

For provider kill-switch: `VITE_LIVE_PROVIDERS_ENABLED=false` immediately forces mock selection.

## Related

- `docs/LIVE_PROVIDER_ENABLEMENT.md`
- `docs/CONFIGURATION.md`
- `docs/OBSERVABILITY.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/ENVIRONMENT_VARIABLES.md`
