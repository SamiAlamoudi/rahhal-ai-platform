# Production Checklist — Rahhal v1 RC

Use this checklist before promoting `1.1.0-rc.1` (or later) beyond staging.

## 1. Build & quality

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint` (zero warnings)
- [ ] `npm run test:run`
- [ ] `npm run providers:check`
- [ ] `npm run preview:verify`
- [ ] `npm run build` / `npm run build:preview`
- [ ] `npm run audit` (high+ clean)
- [ ] `npm run test:rc1` (optional journey/smoke)
- [ ] `npm run test:playwright` (Chromium funnel)

## 2. Environment

- [ ] `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set for target
- [ ] `VITE_PAYMENT_PROVIDER=mock`
- [ ] `VITE_LIVE_PROVIDERS_ENABLED=false` (unless intentionally piloting)
- [ ] No forbidden client secrets (`VITE_AMADEUS_*`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_OPENWEATHER_API_KEY`, `VITE_MOYASAR_*`)
- [ ] No `VITE_DEMO_AUTH=true` on real deployments
- [ ] Edge secrets configured only where proxies are enabled

## 3. Database / Supabase

- [ ] All migrations applied (through `20260720020000_coupons_rls_hardening.sql`)
- [ ] RLS verified: user-owned tables scoped to `auth.uid()`
- [ ] Coupons: authenticated SELECT only; no client INSERT/UPDATE/DELETE
- [ ] Auth flows: signup / login / password reset
- [ ] Chat tables grants present for authenticated role

## 4. Security

- [ ] CSP / security headers present on preview/CDN
- [ ] Moyasar webhook uses **header** secrets only
- [ ] Admin allowlist / `app_metadata.role` reviewed
- [ ] Secret hygiene scan clean in CI
- [ ] No secrets in git history of this release

## 5. Product surfaces

- [ ] `/login` / `/signup` / protected redirect
- [ ] `/chat` — send message, streaming, offline banner, retry
- [ ] Voice composer — mic permission, STT, TTS interrupt (real device)
- [ ] `/search` — confirm plan → ranked mock results
- [ ] `/travel-conversation` — intake + search (TDZ fixed)
- [ ] Booking review → mock checkout success/failure
- [ ] `/my-trips` list / detail / cancel
- [ ] Empty states: no conversations, no trips
- [ ] Loading states: chat list, route Suspense fallback

## 6. Feature flags (production defaults)

| Flag | Expected production |
|------|---------------------|
| `payments.live` | OFF |
| `providers.live_master` | OFF |
| `brain.*` experimental | OFF unless staged pilot |
| `ui.chatgpt_experience` | OFF unless staged pilot |
| `ui.conversation_experience` | OFF unless staged pilot |

## 7. Ops readiness

- [ ] `MONITORING_RUNBOOK.md` / `ALERTING_MATRIX.md` owners assigned
- [ ] `ROLLBACK_PLAN.md` reviewed
- [ ] `HOTFIX_PROCESS.md` acknowledged
- [ ] Health / ready probes (`public/health.json`, `public/ready.json`, Edge `ops-health`) reachable
- [ ] Customer support runbook available

## 8. Sign-off

| Role | Name | Date | OK |
|------|------|------|----|
| Engineering | | | ☐ |
| Product | | | ☐ |
| Security | | | ☐ |
| Ops | | | ☐ |

**Go / No-Go:** _______________
