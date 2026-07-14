# رحّال (Rahhal) — AI Travel Decision Platform

Arabic RTL travel planning SPA: conversation-driven requirements → live flight/hotel search → booking session → (optional) in-app checkout.

> Marketing says “AI”; the conversation/scoring layer is **rule-based** (not LLM). LLM assistance is optional future work.

## Stack

| Layer | Technology |
|-------|------------|
| UI | React 19, React Router 7, Tailwind CSS 4, Cairo (`lang="ar"`) |
| Build | Vite 8, TypeScript |
| Backend | Supabase Auth + Postgres + RLS |
| Providers | Amadeus (flights), Booking.com RapidAPI (hotels), RentalCars, OpenWeather |
| Payments | `PaymentProvider` interface — mock in-app; real PSPs via Edge Functions |
| Tests | Vitest unit tests |

## Architecture (short)

```
Browser SPA
  pages / components
    → utils (travelSession, planTrip, scoring, reasoning)
    → integrations (Amadeus / Booking / … via FlightService & HotelService)
    → lib (auth, bookingSessionService, checkout, repositories)
Supabase
  Auth + migrations (core / booking / checkout)
  Edge Functions: amadeus-token (OAuth proxy); payment authorize (Phase D)
```

**Search entrypoint:** `planTrip()` (`src/utils/tripPlanner.ts`) — preferred UI path from Search Workspace / Travel Conversation.  
**Legacy ranked search:** `orchestrateLiveSearch()` still available for diagnostics / alternate UX.

Amadeus `client_secret` **never** lives in `VITE_*` — token exchange is `supabase/functions/amadeus-token`.

## Local setup

```bash
cp .env.example .env.local
# Fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (required for auth & booking persist)
npm install
npm run dev
```

Apply DB migrations with the [Supabase CLI](https://supabase.com/docs/guides/cli) (see `supabase/config.toml`):

```bash
supabase db push   # or: supabase migration up
```

### Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | Oxlint |
| `npm run test:run` | Vitest once |
| `npm run test:e2e` | Playwright smoke (Phase G) |

## Environment

See [`.env.example`](.env.example). Highlights:

- **Supabase:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Flights:** `VITE_FLIGHT_PROVIDER=amadeus` + Edge secrets `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`
- **Hotels:** `VITE_RAPIDAPI_KEY`, `VITE_BOOKING_HOST`
- **Payments:** `VITE_PAYMENT_PROVIDER=mock` locally; production uses Edge Function secrets

## Product phases (roadmap)

| Phase | Focus | Status in repo |
|-------|--------|----------------|
| A | Docs, env, CI, artifact cleanup | This PR |
| B | Live search via integrations | `planTrip` + adapters |
| C | Persist booking/checkout | Booking sessions persist; checkout persistence in progress |
| D | Real PSP (server-side) | Edge Function + Moyasar scaffolding |
| E | Saved trips, nav, admin RBAC | In progress |
| F | Catalog clarity / optional LLM | Explicit mock “coming soon” for activity/transfer |
| G | CI/E2E/ops | GitHub Actions + Playwright smoke |

## Security notes

- Do not commit `.env.local` or provider secrets.
- Booking V1 does not store card data; Phase 33 checkout keeps PANs off the SPA.
- `/admin` requires authenticated user **and** admin role (`app_metadata.role === 'admin'` or `VITE_ADMIN_USER_IDS`).
- Moyasar `MOYASAR_SECRET_KEY` / `MOYASAR_WEBHOOK_SECRET` are Edge Function secrets only (never `VITE_*`).

## Ops

| Topic | Notes |
|-------|--------|
| Monitoring | Placeholder — wire up Supabase metrics / error tracking (Sentry or equivalent) before production cutover. |
| Staging vs prod | Use separate Supabase projects; SPA `VITE_SUPABASE_*` points at the environment. Never share service-role keys with the SPA. |
| Webhooks | Deploy `moyasar-webhook`; set `MOYASAR_WEBHOOK_SECRET` and verify via `X-Moyasar-Signature` or `x-rahhal-webhook-secret`. Rotate secrets per environment. |
| Payments | Local: `VITE_PAYMENT_PROVIDER=mock`. Staging/prod: `moyasar` + Edge Functions `moyasar-payment` / `moyasar-webhook`. |
| E2E | `npm run test:e2e` (Playwright smoke against `/login`). CI builds then previews on port 5173. |

## License

Private — Rahhal project.
