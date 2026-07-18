# Staging Checklist

Use before promoting a build to the staging host.

For **preview-only** MVP deploys (no production), see [PREVIEW_DEPLOYMENT.md](./PREVIEW_DEPLOYMENT.md) and run `npm run preview:verify` + `npm run build:preview`.

## Pre-deploy

- [ ] CI green on the release commit (typecheck, lint, tests, build, audit, secret scan)
- [ ] `.env.staging` derived from `.env.staging.example` (no real secrets in git)
- [ ] `VITE_PAYMENT_PROVIDER=mock`
- [ ] `VITE_LIVE_PROVIDERS_ENABLED=false` unless a provider pilot is approved
- [ ] Supabase staging project URL + anon key set
- [ ] Edge Functions deployed: `amadeus-token`, `google-maps-proxy`, `openweather-proxy`, `ops-health` (+ payment funcs only if testing mock paths)
- [ ] Edge secrets set **server-side only** for any intentionally enabled live provider
- [ ] `OPS_ALLOWED_ORIGINS` set for staging hostname on `ops-health`

## Smoke

- [ ] `/health.json` returns static ok
- [ ] `ops-health?probe=live` → 200
- [ ] `ops-health?probe=ready` → 200 with `payment_provider_safe.ok=true`
- [ ] SPA boot with no console secret leaks
- [ ] Auth sign-in / sign-out on staging Supabase
- [ ] Mock flight/hotel search via aggregation fallback
- [ ] Booking draft → checkout mock payment → ticketing mock → notification mock (happy path)
- [ ] Forced provider failure still falls back to mocks
- [ ] Error boundary does not expose tokens/stack to users

## Sign-off

- [ ] Engineering
- [ ] Product / ops owner
- [ ] Note commit SHA + deploy time in release channel
