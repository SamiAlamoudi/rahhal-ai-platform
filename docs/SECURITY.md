# Security

## Principles

- No provider OAuth/API secrets in `VITE_*` or client bundles.
- Payments remain mock until `docs/PAYMENT_PRODUCTION_TODO.md` is complete.
- Mask PII/secrets in structured logs (`src/lib/ops/logging/mask.ts`).
- Ownership checks remain enforceable in domain layers / RLS.

## Browser

- Security headers via `public/_headers` and Vite dev/preview middleware.
- CSP default-src self; Supabase + Google Fonts allowlisted.
- React `AppErrorBoundary` + `installGlobalErrorHandlers` — user-safe messages only.
- Output escaping helper: `escapeHtml`.
- Input sanitization: existing `sanitizeInput` + ops validators.

## Edge / API

- CORS helpers support origin allowlists (`OPS_ALLOWED_ORIGINS` for ops-health).
- Request size guard: `assertRequestSize` (default 256 KiB).
- Domain rate limits + auth brute-force protection (`checkDomainRateLimit`, `checkAuthBruteForce`).

## Secrets

| Kind | Location |
|------|----------|
| Amadeus client secret | Supabase secret / `AMADEUS_CLIENT_*` |
| Google Maps key | `GOOGLE_MAPS_API_KEY` (proxy) |
| OpenWeather key | `OPENWEATHER_API_KEY` (proxy) |
| RapidAPI (Booking) | Prefer `RAPIDAPI_KEY` server-side |
| Moyasar | Edge only — **disabled** while payment freeze holds |

Forbidden in client: `VITE_AMADEUS_CLIENT_SECRET`, `VITE_AMADEUS_CLIENT_ID`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_OPENWEATHER_API_KEY`, `VITE_MOYASAR_SECRET*`. Validated by `validateEnvironment` and CI hygiene scan.

`VITE_RAPIDAPI_KEY` / `VITE_BOOKING_API_KEY` still power the SPA hotel adapter when live hotels are opted in; on preview/staging/production targets `validateEnvironment` **warns** that these are client-bundled — prefer a server proxy before production live hotels.

### RC hardening (`1.1.0-rc.1`)

- Coupons RLS: authenticated **SELECT** only (mutations via service role).
- Moyasar webhook: accept secrets via headers only (no `?webhook_secret=`).
- Chat attachment/image/audio URLs filtered by `safeMediaUrl` (blocks `javascript:` and non-image `data:`).

## Dependency audit

- `npm run audit` (`npm audit --audit-level=high`) in CI.
- Document findings in release notes if overrides are ever required.
