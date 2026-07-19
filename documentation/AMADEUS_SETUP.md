# Amadeus Live Flight Setup (Production)

Complete guide to enable live Amadeus flight search on Rahhal.

> **Credential detection (this environment):**  
> `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET` were **not found**.  
> Until they are set on the server (Vercel / Supabase Edge), Rahhal runs in **mock fallback** mode.

> **Platform notice (2026-07-17):**  
> Amadeus announced that the **Self-Service Developers portal was decommissioned**.  
> DNS for `test.api.amadeus.com` / `api.amadeus.com` currently returns no A/AAAA records.  
> You may need **Amadeus Enterprise API** access for a new production host. Keep Rahhal’s token proxy + health checks; update `AMADEUS_BASE_URL` when Enterprise provides the new endpoint.

---

## Required variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `AMADEUS_CLIENT_ID` | **Server only** (Vercel / Edge) | OAuth API Key |
| `AMADEUS_CLIENT_SECRET` | **Server only** (Vercel / Edge) | OAuth API Secret — **never** `VITE_*` |
| `AMADEUS_BASE_URL` | Server | Default `https://test.api.amadeus.com` (sandbox) or production host |
| `VITE_FLIGHT_PROVIDER` | SPA | Set to `amadeus` |
| `VITE_AMADEUS_ENABLED` | SPA | Set to `true` |
| `VITE_AMADEUS_USE_VERCEL_PROXY` | SPA | Default `true` → SPA calls `/api/amadeus-token` |

Optional:

| Variable | Purpose |
|----------|---------|
| `VITE_AMADEUS_TOKEN_URL` | Override token proxy (e.g. Supabase `…/functions/v1/amadeus-token`) |
| `VITE_AMADEUS_BASE_URL` | SPA-visible Amadeus API host (no secrets) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Only if using Supabase Edge token proxy instead of Vercel |

---

## 1. Get Amadeus credentials

1. Open the Amadeus developer / Enterprise portal (Self-Service portal was decommissioned 17 Jul 2026).
2. Create (or request) an application with **Flight Offers Search**, **Airport & City Search**, and **Airline Codes Lookup**.
3. Copy **API Key** → `AMADEUS_CLIENT_ID` and **API Secret** → `AMADEUS_CLIENT_SECRET`.
4. Confirm the **base URL** for your environment and set `AMADEUS_BASE_URL`.

---

## 2. Configure Vercel (recommended production path)

Secrets must be readable by **Vercel Edge Functions** (`api/amadeus-token.ts`, `api/health/providers.ts`):

```bash
# Install CLI and link the project
npm i -g vercel
vercel login
vercel link

# Add secrets (Production + Preview)
vercel env add AMADEUS_CLIENT_ID production
vercel env add AMADEUS_CLIENT_SECRET production
vercel env add AMADEUS_BASE_URL production
# value: https://test.api.amadeus.com   (or Enterprise host)

# SPA build-time flags
vercel env add VITE_FLIGHT_PROVIDER production   # amadeus
vercel env add VITE_AMADEUS_ENABLED production   # true
vercel env add VITE_AMADEUS_USE_VERCEL_PROXY production  # true

vercel --prod
```

Vercel automatically injects `AMADEUS_*` into Edge Functions via `process.env`.  
The SPA **never** receives `AMADEUS_CLIENT_SECRET`.

### Same-origin token proxy

When `VITE_AMADEUS_ENABLED=true` (or `VITE_FLIGHT_PROVIDER=amadeus`), the SPA uses:

```
POST /api/amadeus-token
```

implemented by `api/amadeus-token.ts` (Edge runtime).

---

## 3. Alternative: Supabase Edge Function

```bash
supabase secrets set \
  AMADEUS_CLIENT_ID=... \
  AMADEUS_CLIENT_SECRET=... \
  AMADEUS_BASE_URL=https://test.api.amadeus.com

supabase functions deploy amadeus-token
```

SPA:

```bash
VITE_SUPABASE_URL=https://YOUR.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_AMADEUS_TOKEN_URL=https://YOUR.supabase.co/functions/v1/amadeus-token
VITE_AMADEUS_USE_VERCEL_PROXY=false
VITE_FLIGHT_PROVIDER=amadeus
VITE_AMADEUS_ENABLED=true
```

---

## 4. Local development

Copy `.env.example` → `.env.local`:

```bash
AMADEUS_CLIENT_ID=your_key
AMADEUS_CLIENT_SECRET=your_secret
AMADEUS_BASE_URL=https://test.api.amadeus.com

VITE_FLIGHT_PROVIDER=amadeus
VITE_AMADEUS_ENABLED=true
VITE_AMADEUS_USE_VERCEL_PROXY=true
```

`vite` middleware (`src/lib/viteAmadeusApiPlugin.ts`) serves:

- `GET /api/health/providers`
- `POST /api/amadeus-token`

using Node `process.env` (loaded from `.env.local` when present).

```bash
npm run amadeus:check
npm run dev
```

---

## 5. Health endpoint

`GET /api/health/providers`

Connected:

```json
{
  "amadeus": "connected",
  "fallback": false
}
```

Missing credentials:

```json
{
  "amadeus": "missing_credentials",
  "fallback": true
}
```

Other statuses: `invalid_credentials`, `unreachable`, `error`.

---

## 6. Admin Provider Status card

Admin Dashboard (`/admin`) shows:

- **✓ Amadeus Connected** when health reports `connected` / `fallback: false`
- **⚠ Running in Mock Mode** otherwise

---

## 7. Verify a live search

```bash
npm run amadeus:live-search
# Riyadh (RUH) → Casablanca (CMN), 2026-07-30
```

Expect:

1. Health → `amadeus: connected`
2. Raw Amadeus Flight Offers JSON
3. Mapped Rahhal `FlightOffer[]` / conversation cards
4. `sources.flight === 'real'` from `orchestrateLiveSearch`

Kill switch: `VITE_FLIGHT_PROVIDER=mock`.

---

## Security checklist

- [ ] `AMADEUS_CLIENT_SECRET` is **not** in any `VITE_*` variable
- [ ] Secret is only on Vercel / Supabase Edge
- [ ] `npm run providers:check` passes
- [ ] `/api/health/providers` does not echo secrets
- [ ] Payment remains `VITE_PAYMENT_PROVIDER=mock` until payment freeze lifts

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `missing_credentials` | Set `AMADEUS_CLIENT_ID` + `AMADEUS_CLIENT_SECRET` on the server and redeploy |
| `invalid_credentials` | Rotate keys in Amadeus portal; update Vercel env |
| `unreachable` / DNS failure | Confirm `AMADEUS_BASE_URL`; Self-Service hosts may be offline after portal decommission — request Enterprise host |
| Admin shows Mock Mode | Open `/api/health/providers`; fix credentials; hard-refresh Admin |
| SPA still mock | Ensure `VITE_FLIGHT_PROVIDER=amadeus` was present **at build time** on Vercel |

---

## Related code

- Edge: `api/amadeus-token.ts`, `api/health/providers.ts`, `api/_lib/amadeusEnv.ts`
- SPA provider: `src/integrations/providers/amadeus/FlightProvider.ts`
- Admin card: `src/components/admin/ProviderStatusCard.tsx`
- Env: `.env.example`
