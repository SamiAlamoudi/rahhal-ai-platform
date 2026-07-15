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
| Tests | Vitest unit + RC1 library E2E/smoke |
| Version | `1.0.0-rc1` (release candidate; production tag pending approval) |

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
| `npm run test:e2e` | RC1 journey + failure-path suites |
| `npm run test:smoke` | RC1 staging smoke suite |
| `npm run test:rc1` | All RC1 validation suites |

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
| X | Production hardening & ops readiness | Done |
| Y | Release Candidate RC1 | **Candidate** (`v1.0.0-rc1`) — awaiting tag approval |

Branding rename remains deferred — see [docs/BRANDING_TODO.md](docs/BRANDING_TODO.md).

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
