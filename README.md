# رحّال (Rahhal) — AI Travel Decision Platform

Arabic RTL travel planning SPA: conversation-driven requirements → live flight/hotel search → booking session → (optional) in-app checkout.

> Marketing says “AI”; the conversation/scoring layer is **rule-based** (not LLM). LLM assistance is optional future work.

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, React Router 7, Tailwind CSS 4, Arabic RTL |
| Build | Vite 8, TypeScript |
| Backend | Supabase Auth + Postgres + RLS |
| Providers | Amadeus (flights), Booking.com RapidAPI (hotels), RentalCars, OpenWeather |
| Payments | Moyasar hosted checkout via Edge Functions — **frozen for production** pending business verification (see below) |
| Tests | Vitest unit tests |

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
| `npm run lint` | Oxlint |
| `npm run test:run` | Vitest once |

## Product phases (roadmap)

| Phase | Focus | Status |
|-------|--------|--------|
| A | Docs, env, CI hygiene | Done |
| B | Live search via integrations | Done (`orchestrateLiveSearch` / `planTrip`) |
| C | Persist booking/checkout | Done |
| D | Real PSP (Moyasar) | **Code complete — production enablement frozen** |
| E | Saved trips, settings, admin RBAC | Done |
| F | Admin dashboard management + catalog clarity | Admin overview/users/trips/bookings + mock payments; catalog flags deferred |
| G | AI Chat (+ shared `chatEngine`) | Text chat, search, streaming, attachment architecture |
| H | Realtime Voice Conversation on same engine | STT/TTS, PTT/hands-free, interrupt; no phone/video |
| H.5 | Chat & voice polish (no new features) | Streaming coalesce, mic UX, interrupt/resume, offline/recovery, a11y, tests |
| I | Travel AI Agent foundation | Orchestration service, TripPlan model, LLM/tool adapters, chat+voice via chatEngine |
| J | Tool execution framework | Mock flights/hotels/weather/maps/currency/visa/attractions + auto tool selection |
| K | Multi-provider aggregation | Parallel mock provider query, normalize, dedupe, rank, confidence, merge |
| L–Y | Intelligent planning → RC1 / v1.0.0 | Done (promoted; see release notes) |
| AA | Post-launch monitoring & stabilization | Done (ops) |
| AB | v1.1 planning & AI enhancement foundation | Done (library; post-MVP) |
| **Production MVP** | Booking persistence → unified funnel → My Trips → Amadeus sandbox → payments prep → E2E → deploy | **Active** — Amadeus sandbox opt-in done; next: payments prep / E2E / deploy |
| AC+ | Recommendation / itinerary AI (post-launch) | Deferred until Production MVP complete |

Branding rename remains deferred — see [docs/BRANDING_TODO.md](docs/BRANDING_TODO.md).

v1.1 AI docs: `V1_1_ROADMAP.md`, `FEATURE_REGISTRY.md`, `AI_ARCHITECTURE.md`.  
Post-launch ops runbooks: `MONITORING_RUNBOOK.md`, `ALERTING_MATRIX.md`, `HOTFIX_PROCESS.md`, `POST_RELEASE_CHECKLIST.md`, `INCIDENT_TEMPLATE.md`, `CUSTOMER_SUPPORT_RUNBOOK.md`.

## Payments freeze (Phase D)

Moyasar hosted checkout is implemented and must not be removed. Production go-live is blocked on business verification.

**TODO checklist:** [docs/PAYMENT_PRODUCTION_TODO.md](docs/PAYMENT_PRODUCTION_TODO.md)

- Business verification
- Live API keys
- Live webhook
- Final sandbox verification

Until then keep `VITE_PAYMENT_PROVIDER=mock` (default). Do not put `MOYASAR_SECRET_KEY` in `VITE_*`.

## Security notes

- Do not commit `.env.local` or provider secrets.
- `/admin` requires authenticated user **and** admin role (`app_metadata.role === 'admin'` or `VITE_ADMIN_USER_IDS`).
- Moyasar secrets are Edge Function secrets only.

## License

Private — Rahhal project.
