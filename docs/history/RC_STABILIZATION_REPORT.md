# RC Stabilization Report — Rahhal `1.1.0-rc.1`

**Branch:** `cursor/rc-cleanup-stabilization-f130`  
**Date:** 2026-07-20  
**Source of truth:** `main` after PR #109 / #111  

---

## Files removed

| Category | Items |
|----------|--------|
| Agent batch artifacts | `batch_*.json`, `batch*_contents/`, `batch_3`–`5/`, `_extracted/`, `_parsed/`, `push_batch.py`, `.gitkeep` (~232 paths, ~30k lines) |
| Unused components | `PlanningProgressCard`, `RankedOptionCard`, `RecommendationReport`, `UnderstandingStatusCard` |
| Orphan page | `CheckoutAdminDashboard.tsx` |
| Duplicate utils | `recommendationReport.ts`, `scoringEngine.ts`, `travelScoreEngine.ts` |
| Stale report | `PRODUCTION_STABILIZATION_REPORT.md` |
| Unused dependency | `@vitest/ui` |

## Files modified / added (high level)

- `AGENTS.md` — removed stale TDZ/CSP demo blockers
- `src/main.tsx` — route-level lazy loading
- `vite.config.ts` — vendor code-splitting groups
- `TravelConversation.tsx` — lazy results UI (matches SearchWorkspace)
- `useSessionPersistence.ts` — timer cleanup on unmount
- `envValidation.ts` — RapidAPI client-key warnings on hardened targets
- `safeMediaUrl.ts` (+ tests) — media URL allowlist
- Chat `MessageBubble` / `AttachmentPreview` — safe URLs
- `moyasar-webhook` — header-only secret verification
- Migration `20260720020000_coupons_rls_hardening.sql`
- Docs: `RELEASE_NOTES_v1.md`, `PRODUCTION_CHECKLIST.md`, README / CHANGELOG / AI_ARCHITECTURE / FEATURE_REGISTRY updates

## Bugs fixed

| Bug | Fix |
|-----|-----|
| Stale AGENTS.md claimed TravelConversation TDZ crash | Doc corrected (code already fixed) |
| Stale AGENTS.md claimed blank-page CSP in committed vite | Doc corrected (dev CSP already relaxed) |
| Oxlint warnings (useless spreads, unused var, unsafe optional chain) | Fixed without suppressions |
| Coupons RLS allowed any authenticated user full CRUD | SELECT-only for authenticated |
| Webhook secret accepted via query string | Removed |
| Unsanitized attachment / audio / image URLs | `safeMediaUrl` allowlist |
| Session save timer could fire after unmount | Cleared on cleanup |

## Performance improvements

| Before | After |
|--------|--------|
| Single JS chunk ~2022 kB (~538 kB gzip) | Entry `index-*.js` ~24 kB; routes/vendors split |
| All pages eager in router | `React.lazy` + Suspense per route |
| TravelConversation static Results/Decision | Lazy + Suspense (parity with SearchWorkspace) |
| No vendor split | `vendor-react`, `vendor-router`, `vendor-supabase` |

ChatPage remains the largest route chunk (~569 kB) because it owns agent/brain/chat stacks — loaded only on `/chat`.

## Security improvements

- Coupons mutation surface closed to clients
- Moyasar webhook secret no longer via query
- Chat media scheme allowlist (`https`/`http`/relative/`blob`/`data:image`)
- RapidAPI `VITE_*` keys warn on preview/staging/production
- Persist timer leak closed

**Remaining (tracked debt, not RC blockers for mock-default posture):**
- Edge provider proxies accept anon JWT + open CORS (quota abuse risk if live)
- Admin gate is SPA-only (`VITE_ADMIN_USER_IDS` / `app_metadata`)
- RapidAPI keys still readable via `VITE_*` for live hotel adapter (needs server proxy to eliminate)

## Test results

```
Test Files  144 passed (144)
Tests       1600 passed (1600)
```

Includes new `safeMediaUrl` unit tests (+4).

## Build results

```
npm run typecheck  → pass
npm run lint       → pass (0 warnings)
npm run build      → pass (code-split assets)
npm install        → 0 vulnerabilities
```

## Architecture validation summary

| Area | Score notes |
|------|-------------|
| Feature registry | 63/63 IDs match code |
| Agent / chat / voiceConversation internal cycles | None |
| Critical cycles | Still present in `utils` planning + contracts↔integrations (documented debt) |
| Parallel SoTs | Legacy utils conversation vs Chat/agent/brain; dual voice stacks; dual payment/execution packages |

**Overall architecture score: 6.5 / 10**  
Solid feature registry and package maps; score held down by sprint accretion (parallel engines, import cycles, `utils` as domain layer).

**Production readiness score: 8.0 / 10**  
Quality gates green, mock-default posture safe, chat/voice/booking paths verified present, RC docs complete. Deducted for: large ChatPage chunk, open Edge proxy posture when live, RapidAPI client keys, experimental flags sprawl, Chromium-only browser E2E.

## Remaining technical debt

1. Break `travelSession` ↔ `requirementAnalyzer` and contracts↔integrations cycles (extract leaf types).
2. Document / eventually converge conversation SoTs (legacy vs `/chat`).
3. Server-proxy RapidAPI / Booking keys; remove client bundling.
4. Authenticate + rate-limit Edge provider proxies; tighten CORS.
5. Server-side admin authorization for sensitive mutations.
6. Further split ChatPage / agent chunk.
7. Multi-browser Playwright + hosted preview URL automation.
8. Align Vite CSP helper with `buildSecurityHeaders()` (single source).

## Release recommendation

**Go for Release Candidate** under mock-payment / live-providers-OFF posture.  
Promote beyond staging only after `PRODUCTION_CHECKLIST.md` sign-off and migration apply.
