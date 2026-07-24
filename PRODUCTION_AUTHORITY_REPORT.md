# Production Authority — Engineering Report

**Branch:** `cursor/production-authority-7518`  
**Scope:** Final production hardening sprint only (no product features).  
**AI cores preserved:** Decision Engine, Planning Draft, Conversation Brain, Smart Clarification (behavior/contracts unchanged).

## Objectives → Outcomes

| # | Objective | Outcome |
|---|-----------|---------|
| 1 | Remove client-side secrets (`VITE_OPENAI_*` / `VITE_RAPIDAPI_*`) | Done — also `VITE_BOOKING_API_KEY` / `VITE_AGENT_OPENAI_API_KEY`. Hard-fail in `validateEnvironment`. |
| 2 | Privileged calls behind Edge Functions | Done — `openai-proxy`, `booking-proxy` (Supabase + Vercel). Existing Maps/Weather/Amadeus/Moyasar proxies hardened. |
| 3 | Strict auth + CORS allowlists | Done — `supabase/functions/_shared/edgeSecurity.ts` + `api/_lib/edgeSecurity.ts`. |
| 4 | Split `planTurn` into stages | Done — stage wrappers in `planTurn/stages.ts` + abort checkpoints; external behavior unchanged. |
| 5 | ChatPage lazy-load quarantined modules | Done — dynamic import of booking bridge / timeline / cards / live bus; lazy banner + experience panel. |
| 6 | Streaming cancellation checkpoints | Done — `assertTurnNotAborted` at stage boundaries and inside `speakTravelFacts`. |
| 7–10 | Preserve AI behavior, contracts, tests; no new features | Targeted; validated via lint / typecheck / full test suite. |

## Change inventory

### Edge / API security
- **Shared helpers:** CORS allowlist via `EDGE_ALLOWED_ORIGINS` / `OPS_ALLOWED_ORIGINS`; require Bearer/`apikey` matching anon or service role.
- **New:** `supabase/functions/openai-proxy`, `supabase/functions/booking-proxy`, `api/openai-proxy.ts`, `api/booking-proxy.ts`.
- **Hardened:** `amadeus-token`, `openweather-proxy`, `google-maps-proxy`, `moyasar-payment`, `moyasar-webhook` (webhook secret retained), `ops-health` (CORS + expanded forbidden-secret probe), Vercel `amadeus-token` + `health/providers`.

### Client secret removal
- `openaiLlmAdapter` → proxy + anon (or server `OPENAI_API_KEY` in Node); never reads `VITE_OPENAI_*`.
- Booking config / registry / liveProviders → server `RAPIDAPI_KEY`/`BOOKING_API_KEY` or `booking-proxy`; never reads `VITE_RAPIDAPI_KEY` / `VITE_BOOKING_API_KEY`.
- `envValidation` hard-fails all listed client secrets on every target.
- `.env.example` updated to document server-only secrets + proxy URLs.

### planTurn maintainability
- `src/lib/agent/planTurn/abortCheckpoint.ts`
- `src/lib/agent/planTurn/stages.ts` — named stages: init memory → pre-brain enrichers → Rahhal brain → brain pipeline → early intent routers → concierge → LLM/tools → autonomous → presentation → final speak.
- Cooperative abort checks at start, after memory, before concierge/LLM/tools/final speak, and before Conversation Brain speak.

### Chat quarantine
- `ChatPage` imports leaf feature/theme/recovery modules only; experience runtime loaded when flag is on.
- `MessageBubble` lazy-loads `ConversationExperiencePanel`.
- `chatProviderFactory` no longer statically imports quarantined providers; tests use `chatProviderFactory.quarantined.ts`.

## Validation

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run test:run` — (recorded with this PR)

## Remaining technical debt

1. **planTurn body still large** — stages are wrappers around the existing body in `travelAgentService.ts`; extracting stage *bodies* into separate modules would further shrink the factory file without behavior change.
2. **Empty CORS allowlist → `*`** — local/dev convenience; production must set `EDGE_ALLOWED_ORIGINS` / `OPS_ALLOWED_ORIGINS`.
3. **ops-health unauthenticated** — intentional for LB probes; does not return secrets.
4. **Amadeus Vercel same-origin** — allows missing invoke credential when `Origin` is absent (SPA relative `/api/amadeus-token`); OpenAI/Booking proxies require credentials strictly.
5. **Rental cars / other RapidAPI hosts** — SPA no longer ships RapidAPI keys; live rental path needs its own proxy if re-enabled beyond mock.
6. **liveProviders Booking adapter** — still uses direct RapidAPI headers when a *server* key is present (Node); browser path should prefer proxy (aggregation adapter already does).
7. **MessageBubble / experience components** — some experience card modules still import the conversationExperienceUi barrel; further leaf imports would shrink optional chunks more.
8. **Docs** (`docs/EXPERIENCE_SPRINT2.md`, `docs/SECURITY.md`) may still mention legacy `VITE_OPENAI_*` / warn-only RapidAPI — update in a docs-only follow-up.

## Explicit non-goals (honored)

- No rewrite of Decision Engine / Planning Draft / Conversation Brain / Smart Clarification.
- No new traveler-facing product features.
- Mock-default provider behavior preserved for CI (no broad `.env.local` secrets).
