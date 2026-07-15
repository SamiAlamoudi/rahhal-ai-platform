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
| I | CI/E2E/ops | Partial |

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
