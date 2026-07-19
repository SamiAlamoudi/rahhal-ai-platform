# AGENTS.md

## Cursor Cloud specific instructions

Rahhal (رحّال) is an Arabic RTL travel-planning SPA: React 19 + React Router 7 + Tailwind 4, built with Vite 8 + TypeScript, backed by Supabase (auth/Postgres/RLS). All external providers (flights/hotels/weather/maps/payments/chat/voice) default to **mock adapters** in code, so no API keys are needed for local development.

Standard scripts live in `package.json` (`dev`, `build`, `lint`, `test`, `test:run`, `test:rc1`, `providers:check`, `preview`) and the setup flow is in `README.md`. The notes below are only the non-obvious gotchas.

### `.env.local` must stay minimal (do NOT copy the full `.env.example`)
The SPA needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set to *something* to boot, because `src/lib/supabaseClient.ts` calls `createClient()` at import time and throws if they are missing. A minimal `.env.local` with placeholder Supabase values (real values not required just to boot) is enough; every other provider stays on mock via code defaults.

Do NOT `cp .env.example .env.local` for dev: the example file flips live adapters on (e.g. `VITE_HOTEL_ADAPTER=booking`, `VITE_WEATHER_ADAPTER=openweather`). Vite loads `.env.local` into the Vitest run too, so those overrides make ~6 provider tests fail (they assert mock defaults / auto-enable behavior). CI passes because it runs tests with **no** `.env.local` present. Keep `.env.local` to just the two Supabase placeholders.

### `npm run dev` shows a BLANK page in the browser (known caveat)
The dev server *process* starts cleanly and serves HTTP 200, but the rendered page is blank white. Cause: the `securityHeadersPlugin` in `vite.config.ts` applies CSP `script-src 'self'` to the **dev** server (`configureServer`), which blocks Vite's inline react-refresh preamble script, producing `@vitejs/plugin-react can't detect preamble` and preventing React from mounting. This is a pre-existing config issue, not a dependency problem.

To actually view/interact with the app locally, use the production build, whose scripts are external bundle files that satisfy `script-src 'self'`:

```bash
npm run build
npm run preview   # renders correctly, no console errors — this is Vercel Preview parity
```

(If a future task is explicitly to make `npm run dev` render, the fix is to stop applying the strict `script-src 'self'` to the dev server — e.g. scope the strict CSP to preview/production only, or allow inline/nonce scripts in dev.)

### Auth is Supabase-gated
`/` and most routes are behind `ProtectedRoute` and redirect to `/login`. There is no mock/dev auth path. With only placeholder Supabase values you can render `/login`, `/signup`, `/forgot-password` but cannot complete real sign-up/login or the auth-gated trip-planning UI. Set real `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (a Supabase project) to exercise those flows. The core trip-planning/search logic itself is covered headlessly by tests — `npm run test:rc1` and `npm run test:e2e` run the RC1 core-journey suite.
