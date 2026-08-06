# AGENTS.md

## Cursor Cloud specific instructions

Bilamo (بيلامو) is a single-page React 19 + Vite 8 + TypeScript app (Arabic RTL) for AI-style travel planning. Backend is Supabase (Auth + Postgres + RLS). The conversation/scoring/search engine is rule-based and runs client-side against **mock** provider adapters by default (no external API keys needed).

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

**Dev CSP:** `vite.config.ts` already relaxes the **dev** profile (`script-src 'self' 'unsafe-inline'`, plus local HMR websockets / `http://127.0.0.1:*` in `connect-src`) so React Refresh works. Production/preview CSP stays strict (`script-src 'self'` only). Do not weaken the production profile.

**Local Supabase grants gotcha:** the migrations create RLS policies but no table-level `GRANT`s. Hosted Supabase auto-grants to `authenticated`/`anon`; a local stack does not, so DB reads/writes are permission-denied (the app swallows these errors, so persistence silently no-ops — planning/search still works). If you need persistence locally, run once:
```
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
```

### Demo tips
- Primary chat UX: `/chat` (LegacyChatPage → chatEngine → `travelAgentService.planTurn`). Recovery Phase 1 froze this as the sole conversation spine.
- `/travel-conversation` redirects to `/chat` (legacy page quarantined).
- Legacy mock search form: `/search` (SearchWorkspace) — fill destination, departure city, flexible dates (or a date), duration, adults, budget amount + currency, then click "أكد خطتي وابدأ البحث".
- Voice on `/chat` is browser voice *input* into the same turn (not realtime duplex). After an assistant reply, mic stays **IDLE** — tap mic again for the next turn (no auto-relisten; `interrupt_response: false`).
