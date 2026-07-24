# FINAL Production Checklist

**Purpose:** Pre–feature-development gate for Rahhal AI Platform  
**Audit:** `FINAL_ARCHITECTURE_AUDIT.md`  
**Debt register:** `FINAL_TECHNICAL_DEBT.md`  
**Date:** 2026-07-24  

---

## A. Quality gates (must be green)

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:run` (2633 tests)
- [x] `npm run arch:circular`
- [x] `bash scripts/secret-hygiene-scan.sh`
- [x] CI workflow present: secret hygiene → typecheck → lint → circular → test → providers:check → build → audit → e2e

---

## B. Architecture freeze

- [x] Single production chat SoT: `/chat` → `LegacyChatPage` → `travel-agent` → `planTurn`
- [x] Legacy `/travel-conversation` redirects to `/chat`
- [x] Quarantined chat providers not creatable from default factory
- [x] Decision Engine / Planning Draft / Conversation Brain / Smart Clarification present and not rewritten in this audit
- [x] planTurn is stage-orchestrated (`runPlanTurn` + typed stage modules)
- [x] No circular dependencies under `src/`

---

## C. Security & secrets

- [x] No SPA reads of `VITE_OPENAI_*` / `VITE_RAPIDAPI_*` / `VITE_BOOKING_API_KEY` / Maps / Weather / Moyasar / Amadeus client secrets
- [x] `validateEnvironment` hard-fails forbidden `VITE_*` secrets
- [x] OpenAI + Booking privileged calls go through Edge proxies (anon invoke)
- [x] Edge shared CORS allowlist + invoke auth helpers exist
- [x] `.env.example` has **no active** forbidden `VITE_*` secret assignments
- [ ] **Ops (deploy):** Set `EDGE_ALLOWED_ORIGINS` or per-target `EDGE_ALLOWED_ORIGINS_PRODUCTION` / `_STAGING` / `_LOCAL` on real environments
- [ ] **Ops (deploy):** Confirm Edge secrets `OPENAI_API_KEY`, `RAPIDAPI_KEY`/`BOOKING_API_KEY`, Amadeus, Maps, Weather are server-only (never VITE)
- [ ] **Ops (deploy):** Keep `RENTAL_PROXY_ENABLED` unset/false until rental wiring sprint

---

## D. Providers & payments

- [x] Mock-default provider posture for CI / local without broad `.env.local`
- [x] Payment provider default mock for hardened targets
- [x] Rental proxy scaffold disabled by default (no behavior change)
- [ ] **Ops:** Live providers remain OFF unless intentionally enabled with Edge secrets reviewed

---

## E. Documentation & debt hygiene

- [x] `FINAL_ARCHITECTURE_AUDIT.md` published
- [x] `FINAL_TECHNICAL_DEBT.md` published (authoritative over stale H5 in old `TECHNICAL_DEBT.md`)
- [ ] Docs scrub: remove `VITE_OPENAI_API_KEY` enable instructions from `docs/EXPERIENCE_SPRINT2.md`
- [ ] Docs scrub: update `docs/SECURITY.md` RapidAPI section to match hard-fail + proxy
- [ ] Align `AI_ARCHITECTURE.md` / `README.md` with Recovery Phase 1 redirects
- [ ] Optional: delete or archive unused `src/domains/**`, `src/ui/**`, `TravelConversation.tsx`

---

## F. Feature-development rules (going forward)

1. Do **not** rewrite frozen AI cores or Production Authority proxies without an incident-level reason.  
2. Do **not** reintroduce `VITE_*` provider secrets.  
3. Do **not** re-enable quarantined chat providers on the default factory.  
4. Prefer extending `planTurn` stages / tools over new parallel conversation SoTs.  
5. New live suppliers go behind Edge proxies + allowlisted CORS.  
6. Treat `/search` as secondary intake unless product explicitly re-scopes it.  

---

## G. Verdict

| Gate | Status |
|------|--------|
| Engineering readiness | **READY** |
| Remaining code blockers | **None** |
| Remaining ops checklist | Deploy CORS + Edge secrets (environment config, not code) |
| Remaining hygiene | Docs scrub + quarantine tree cleanup (non-blocking) |

### READY FOR FEATURE DEVELOPMENT

Ops owners should complete section C deploy checkboxes before enabling live providers in staging/production. Engineering may begin feature work on the frozen spine immediately.
