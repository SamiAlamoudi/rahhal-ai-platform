# Preview Deployment (Production MVP)

Preview-only deployment readiness. **Do not deploy to production** from this track.

## Goals

- Ship a preview SPA build with **mock payments** and **live providers disabled**
- Verify required environment variables before publish
- Keep CI + Playwright booking funnel green
- Produce a deployable `dist/` artifact (CI uploads it); host publish is manual until secrets exist

## Safe defaults (required)

| Variable | Required value |
|----------|----------------|
| `VITE_DEPLOY_TARGET` | `preview` (or `staging`) — never `production` |
| `VITE_PAYMENT_PROVIDER` | `mock` |
| `VITE_LIVE_PROVIDERS_ENABLED` | `false` |
| `VITE_PROVIDER_MOCK_FALLBACK` | `true` |
| `VITE_SUPABASE_URL` | Preview/staging Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Preview/staging anon key |

Template: [`.env.preview.example`](../.env.preview.example)

## Local / CI commands

```bash
# Verify preview env (uses .env.preview.example contract in CI)
npm run preview:verify

# Build preview SPA (mock payments + live providers off)
npm run build:preview

# Full quality + providers + build + audit
npm run ci

# Browser funnel E2E
npm run test:playwright
```

## CI

- Workflow **CI** — quality gates + Playwright (`e2e` job)
- Workflow **Preview readiness** (`.github/workflows/preview.yml`) — preview env verify, preview build, providers check, Playwright, uploads `preview-dist` artifact

No production host deploy is triggered by these workflows.

## Post-artifact host publish (manual)

When a preview host is available (Cloudflare Pages / Netlify / Vercel / static bucket):

1. Configure build env from `.env.preview.example` (real Supabase preview values)
2. Publish the CI `preview-dist` artifact or run `npm run build:preview` on the host
3. Confirm `GET /health.json` and `GET /ready.json`
4. Smoke: login → search → results → booking review → payment preparation (mock)
5. Optionally deploy Edge `ops-health` and set `OPS_ALLOWED_ORIGINS` to the preview origin

## Credentials / configuration still required (manual)

| Item | Required for | Notes |
|------|--------------|-------|
| Supabase **preview** project URL + anon key | Auth + persistence | Create/use non-prod project; never commit secrets |
| Preview static host (Cloudflare/Netlify/Vercel/etc.) | Public preview URL | Not configured in-repo; wire secrets on the host |
| `OPS_ALLOWED_ORIGINS` on Edge `ops-health` | Ready probe from preview origin | Only if Edge functions are deployed for preview |
| Edge Functions (`ops-health`, optional proxies) | Full ops probes | Optional for static SPA preview |
| Amadeus / maps / weather / RapidAPI secrets | Live provider pilots | **Not required** — must stay disabled for MVP preview |
| Moyasar live keys | Card payments | **Forbidden** for preview — keep `VITE_PAYMENT_PROVIDER=mock` |

## Explicitly out of scope

- Production deploy / production DNS / production Supabase
- Enabling Moyasar or live provider master switch
- Writing real secrets into the repository
