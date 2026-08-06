# بيلامو (Bilamo) — AI Travel Decision Platform

Arabic RTL travel planning SPA: conversation-driven requirements → live flight/hotel search → booking session → (optional) in-app checkout.

> Marketing says “AI”; the conversation/scoring layer is **rule-based** (not LLM). LLM assistance is optional and flag-gated.

**Current package version:** `1.1.0-rc.1` — see [`RELEASE_NOTES_v1.md`](RELEASE_NOTES_v1.md) and [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, React Router 7, Tailwind CSS 4, Arabic RTL |
| Build | Vite 8, TypeScript |
| Backend | Supabase Auth + Postgres + RLS |
| Providers | Amadeus (flights), Booking.com RapidAPI (hotels), RentalCars, OpenWeather |
| Payments | Moyasar hosted checkout via Edge Functions — **frozen for production** pending business verification (see below) |
| Tests | Vitest unit tests + Playwright Chromium funnel |

## Local setup

```bash
cp .env.example .env.local
# Fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (required for auth & persistence)
npm install
npm run dev
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run build:preview` | Preview SPA build (mock payments, live providers off) |
| `npm run preview:verify` | Preview env gate (see `docs/PREVIEW_DEPLOYMENT.md`) |
| `npm run test:playwright` | Browser booking funnel E2E |
| `npm run lint` | Oxlint |
| `npm run test:run` | Vitest once |
| `npm run typecheck` | TypeScript project build check |
| `npm run providers:check` | Provider config readiness (no network by default) |

## Product surfaces (production defaults)

| Route | Role |
|-------|------|
| `/chat` | Primary AI conversation (streaming + voice) |
| `/search` | Legacy planning workspace + mock ranked search |
| `/travel-conversation` | Legacy conversational intake |
| `/my-trips`, `/checkout/*` | Booking lifecycle (mock payment) |

Experimental Sprint 42–44 UX/orchestrator flags default **OFF** — see `FEATURE_REGISTRY.md`.

## Product phases (roadmap)

| Phase | Focus | Status |
|-------|--------|--------|
| A–K | Foundation through multi-provider aggregation | Done |
| L–Y | Intelligent planning → RC1 / v1.0.0 | Done |
| AA | Post-launch monitoring & stabilization | Done |
| AB | v1.1 AI enhancement foundation | Done (library) |
| Sprint 42–44 | Conversation UX / AI orchestrator / ChatGPT-like shell | Merged; flags default OFF |
| **v1.1.0-rc.1** | Repository cleanup + production readiness | **Active** — `RELEASE_NOTES_v1.md` |
| D (payments) | Moyasar production enablement | **Frozen** pending business verification |
| AC+ | Recommendation / itinerary AI | Deferred |

Branding rename remains deferred — see [docs/BRANDING_TODO.md](docs/BRANDING_TODO.md).

v1 docs: `RELEASE_NOTES_v1.md`, `PRODUCTION_CHECKLIST.md`, `FEATURE_REGISTRY.md`, `AI_ARCHITECTURE.md`, `V1_1_ROADMAP.md`, `RC_STABILIZATION_REPORT.md`.  
Architecture: `ARCHITECTURE_GUIDE.md`, `MODULE_MAP.md`, `DEPENDENCY_GRAPH.md`, `SYSTEM_OVERVIEW.md`, `ROADMAP_TECHNICAL.md`, `TECHNICAL_DEBT.md`, `ARCHITECTURE_METRICS.md`, `src/domains/README.md`.  
Ops runbooks: `MONITORING_RUNBOOK.md`, `ALERTING_MATRIX.md`, `HOTFIX_PROCESS.md`, `POST_RELEASE_CHECKLIST.md`, `INCIDENT_TEMPLATE.md`, `CUSTOMER_SUPPORT_RUNBOOK.md`.

| Script | Purpose |
|--------|---------|
| `npm run arch:circular` | Fail CI/local if `src/` gains import cycles |

## Payments freeze (Phase D)

Moyasar hosted checkout is implemented and must not be removed. Production go-live is blocked on business verification.

**TODO checklist:** [docs/PAYMENT_PRODUCTION_TODO.md](docs/PAYMENT_PRODUCTION_TODO.md)

Until then keep `VITE_PAYMENT_PROVIDER=mock` (default). Do not put `MOYASAR_SECRET_KEY` in `VITE_*`. Webhooks must use **header** secrets only (no query `webhook_secret`).

## Security notes

- Do not commit `.env.local` or provider secrets.
- `/admin` requires authenticated user **and** admin role (`app_metadata.role === 'admin'` or `VITE_ADMIN_USER_IDS`).
- Moyasar secrets are Edge Function secrets only.
- See [docs/SECURITY.md](docs/SECURITY.md) and `PRODUCTION_CHECKLIST.md`.

## License

Private — Rahhal project.
