# Deployment Guide (V1)

## Prerequisites

- Node 20+
- `npm ci`
- Hosted Supabase project (URL + anon key)
- Optional: Edge secrets for live providers (not required for V1 mock mode)

## Environment (production)

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
VITE_PAYMENT_PROVIDER=mock
VITE_LIVE_PROVIDERS_ENABLED=false
VITE_DEPLOY_TARGET=production
```

Do **not** put Amadeus/Booking secrets in `VITE_*`.

## Build & deploy

```bash
npm run ci          # typecheck, lint, tests, providers check, build, audit
npm run build
```

Static host (e.g. Netlify) serves `dist/` with `public/_headers` CSP.

## Post-deploy probes

- `/health.json`, `/ready.json`
- Edge: `ops-health` (`live` / `ready` / `health`)
- Library: `checkLiveness()`, `checkReadiness()`, `checkHealth()`, `runDependencyChecks()`

## Rollback

Follow root `ROLLBACK_PLAN.md`. Prefer flag-off (`VITE_LIVE_PROVIDERS_ENABLED=false`) before binary rollback.
