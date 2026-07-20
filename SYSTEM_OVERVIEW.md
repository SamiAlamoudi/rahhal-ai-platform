# System Overview

Rahhal (رحّال) is an Arabic RTL travel decision SPA. Conversation and scoring are **rule-based** by default; optional AI/brain layers are feature-flagged.

## Runtime surfaces

| Surface | Route / entry | Domain |
|---------|---------------|--------|
| Primary chat | `/chat` | conversation + ai + voice |
| Legacy intake | `/travel-conversation` | conversation + core |
| Search workspace | `/search` | core + conversation |
| Booking funnel | `/booking/*`, `/checkout/*` | booking + payments |
| My Trips | `/my-trips` | booking + core |
| Auth | `/login`, `/signup` | auth |
| Admin | `/admin/*` | infrastructure + auth |

## Data & auth

- **Supabase Auth** + Postgres + RLS (`supabase/migrations`)
- Client: `lib/supabaseClient` (infrastructure)
- Repositories: `lib/repositories/*` (infrastructure)
- Secrets: Edge Functions / server env only (Amadeus, Maps, Weather, Moyasar)

## Provider path

```
UI / Core search
    → integrations registry + adapters (infrastructure)
    → utils/contracts ports (shared)
    → mock or live adapters (Amadeus, Booking.com, …)
```

Live providers default **OFF**; mock fallback **ON**.

## AI / conversation path

```
ChatPage
  → chat engine (conversation)
  → travel agent service (ai)
  → optional brain / orchestrator / chatgpt UX (flags OFF by default)
  → tools + aggregation (ai sub-modules)
```

Streaming is client-side chunking of composed replies (not a live external LLM stream unless a provider is wired later).

## Payment path

```
Booking session → checkout (lib/payment) → mock PSP
Optional Sprint 34 payments platform (flag OFF)
Moyasar Edge Functions exist but production enablement is frozen
```

## Observability & ops

- `lib/ops` — env validation, health, monitoring, security headers, masking
- CI: typecheck, lint, tests, providers:check, audit, `arch:circular`

## Non-goals of this architecture pass

- No new product features
- No UI redesign
- No payment unfreeze
- No physical move of all `lib/` files (façades first)
