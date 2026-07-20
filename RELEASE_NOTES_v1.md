# Release Notes — Rahhal Platform v1

**Release candidate:** `1.1.0-rc.1` (stabilization of `main` after Sprint 44 / PR #111)  
**Base:** `v1.0.1` + Sprints 42–44 + RC cleanup  
**Date:** 2026-07-20  
**Payment mode:** `VITE_PAYMENT_PROVIDER=mock` (unchanged)  
**Live travel providers:** OFF by default (unchanged)

## Summary

This Release Candidate does **not** invent features. It stabilizes the production tree on `main` after the Sprint 42–44 merges: repository cleanup, quality-gate verification, safe performance/security hardening, and production documentation.

## Included since v1.0.1

| Area | Status | Notes |
|------|--------|-------|
| Sprint 42 Conversation Experience & Booking UX | Code present | Flag `ui.conversation_experience` default **OFF** |
| Sprint 43 Rahhal AI Orchestrator | Code present | Flag `brain.ai_orchestrator` default **OFF** |
| Sprint 44 ChatGPT-like conversation UX | Code present | Flag `ui.chatgpt_experience` default **OFF** |
| Production chat (`/chat`) | Stable | Streaming, voice STT/TTS, offline banner, persistence |
| Legacy planning (`/travel-conversation`, `/search`) | Stable | Mock search engine; TDZ crash fixed |
| Booking / My Trips / Checkout | Stable | Mock payment only |
| Supabase Auth + RLS | Stable | Coupons RLS hardened in this RC |

## RC stabilization highlights

### Cleanup
- Removed ~30k lines of agent batch push artifacts
- Deleted unused duplicate utils and orphaned components/pages
- Removed unused `@vitest/ui` dependency
- Cleared all oxlint warnings (no suppressions)

### Performance
- Route-level `React.lazy` code-splitting (entry JS ~24 kB vs prior ~2 MB monolith)
- Vendor chunks for React / Router / Supabase
- Lazy ResultsExperience / DecisionDashboard on TravelConversation

### Security
- Coupons table: authenticated **SELECT only** (mutations require service role)
- Moyasar webhook: header secret only (query `webhook_secret` removed)
- Chat media URL allowlist (`safeMediaUrl`)
- RapidAPI `VITE_*` keys warn on preview/staging/production targets
- Session persist timer cleared on unmount

## Quality gates (verified)

```bash
npm install
npm run typecheck   # pass
npm run lint        # pass (0 warnings)
npm run test:run    # 1600 tests / 144 files
npm run build       # pass
```

## What did not change

- No new product features
- No UI redesign or branding rename
- No business-logic changes to planning, scoring, or booking
- Live payments remain frozen
- Experimental Sprint flags remain default-OFF

## Upgrade / deploy notes

1. Apply migrations (includes `20260720020000_coupons_rls_hardening.sql`).
2. Keep `VITE_PAYMENT_PROVIDER=mock` and live providers OFF for this RC.
3. Prefer `/chat` for the production conversation surface; enable Sprint 42–44 flags only in staging with monitoring.
4. Moyasar webhooks must send `X-Moyasar-Signature` or `x-rahhal-webhook-secret` headers (query secrets no longer accepted).

## Known limitations

See `KNOWN_ISSUES.md`. Notable: Chromium-only Playwright funnel; preview host publish is manual; voice media APIs mocked in CI; RapidAPI hotel keys still readable via `VITE_*` until a server proxy lands.
