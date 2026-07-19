# AGENTS.md

## Cursor Cloud specific instructions

Rahhal (رحّال) is a single-page React 19 + Vite 8 + TypeScript app (Arabic RTL) for AI-style travel planning. Backend is Supabase (Auth + Postgres + RLS). The conversation/scoring/search engine is rule-based and runs client-side against **mock** provider adapters by default (no external API keys needed).

Standard scripts live in `package.json` (`dev`, `build`, `lint`, `test:run`, `typecheck`, `providers:check`). CI steps are in `.github/workflows/ci.yml`. The update script already runs `npm ci`.

### Running tests / lint / typecheck / build
- `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build` all work with **no** `.env.local` present (this is exactly how CI runs). Do this for quick verification.
- Do **not** run tests with a broad `.env.local` copied from `.env.example`. Several provider tests assert the default (mock) adapter selection and **fail** if provider-related `VITE_*` vars are set. If you need `.env.local` for the dev server, keep it to only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Running the app in dev (`npm run dev`) — required caveats
The app needs a Supabase backend for auth; all app routes are behind `ProtectedRoute`. Create `.env.local` with just:
```
VITE_SUPABASE_URL=<supabase url>
VITE_SUPABASE_ANON_KEY=<anon key>
```
`src/lib/supabaseClient.ts` calls `createClient` at import time, so without these two vars the app throws on load.

Two backend options:
- Hosted Supabase (matches the app's design): set the two vars above to a hosted project. The committed CSP already allows `https://*.supabase.co`, so **no code changes are needed**.
- Local Supabase (self-contained, needs Docker): `supabase start` (config is committed at `supabase/config.toml`; migrations in `supabase/migrations` auto-apply). Point `.env.local` at the printed local API URL + anon key (`http://127.0.0.1:54321`).

**Dev CSP gotcha (important):** `vite.config.ts` injects strict security headers into the dev server via a plugin. As committed, `script-src 'self'` blocks Vite's inline React-refresh preamble, so `npm run dev` renders a **blank page** with `@vitejs/plugin-react can't detect preamble` in the console. To actually use the dev server you must relax the dev CSP: add `'unsafe-inline'` to `script-src`, and (for local Supabase) add `http://127.0.0.1:54321` to `connect-src`. Treat this as a **local, uncommitted** dev tweak — it must not be committed (it would weaken the app's production security headers, which are intentional).

**Local Supabase grants gotcha:** the migrations create RLS policies but no table-level `GRANT`s. Hosted Supabase auto-grants to `authenticated`/`anon`; a local stack does not, so DB reads/writes are permission-denied (the app swallows these errors, so persistence silently no-ops — planning/search still works). If you need persistence locally, run once:
```
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
```

### Known app bug when demoing
Starting planning from the Home page with prefilled trip text navigates to `/travel-conversation`, which crashes (error boundary "Something went wrong"). Cause: `src/pages/TravelConversation.tsx` reads `msgIdRef` inside the `messages` `useState` initializer before the ref is declared (temporal-dead-zone `ReferenceError`) whenever the initial text yields detected fields. To exercise the core planning + search engine, use `/search` (SearchWorkspace) instead: fill destination, departure city, flexible dates (or a date), duration, adults, budget amount + currency, then click "أكد خطتي وابدأ البحث" to get ranked recommendations from the mock engine.
