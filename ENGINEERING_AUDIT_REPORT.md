# Engineering Audit Report

**Date:** 2026-07-24  
**Branch:** `cursor/engineering-audit-cleanup-7518`  
**Baseline:** `main` @ `#200` (Planning Draft) + Recovery Phase 1  
**Mode:** Quality only — no product features, no Planning Draft / Decision Engine / Conversation Brain rewrites.

---

## 1. Repository Health Score

| Dimension | Score (1–10) | Notes |
|-----------|--------------|-------|
| Architecture | **7** | Clear planTurn spine; quarantined parallels remain on disk |
| Maintainability | **6 → 7** | Removed unused domains + legacy page cluster; docs SoT corrected |
| Scalability | **6** | Fine for SPA; ChatPage chunk + fat barrels remain |
| Performance | **6** | No hot-path rewrite this pass; static import graph still heavy |
| AI Design | **8** | Decision Engine + Planning Draft + Conversation Brain layered correctly |
| Testing | **8** | Large Vitest suite; circular-dep gate green |
| Security | **6** | Known Edge/CORS/`VITE_*` RapidAPI debt unchanged |
| Developer Experience | **7** | Docs consolidated; MODULE_MAP matches reality |
| **Production Readiness** | **7** | Safer/cleaner baseline; Phase-2 quarantine deletion still open |

**Overall health: 7 / 10** (was ~6.5 pre-cleanup).

---

## 2. Files Reviewed

| Area | Scope |
|------|-------|
| `src/lib/**` | ~1390 TS modules — agent, concierge, chat, payment, quarantined stacks |
| `src/core/**` | ~173 engine modules (actively wrapped by agent) |
| `src/domains/**` | 45 files — **confirmed unused, deleted** |
| `src/pages`, `src/components`, `src/utils` | Routes + legacy intake |
| `archive/`, `docs/`, `documentation/` | Quarantine + doc trees |
| Root `*.md`, `package.json`, Vite/Vitest/CI configs | Tooling + docs |
| Scripts + `api/` | Amadeus helpers, health |

---

## 3. Problems Found

1. Unused `src/domains` DDD façades (zero importers) while docs claimed they were the public API.
2. Legacy `TravelConversation` page + `DecisionProfile` / `LiveSummaryCard` / `rahhalVoice` only referenced each other (route already redirected).
3. Dead exports in `formatReply.ts` (`resolveSpokenText`, `shortenForSpeech`, `buildSaveAck`, `buildEditAck`).
4. Unused barrels: `lib/security/index.ts`, `integrations/providers/index.ts`, unused googleMaps/openWeather barrels.
5. Dual doc trees (`docs/` + `documentation/`).
6. Point-in-time release/RC reports cluttering repo root.
7. Architecture docs drift (domains-as-SoT) vs Recovery Phase 1 reality (`lib` spine).
8. Remaining debt (kept): quarantined `lib/payments` / `finance` / `voiceConversation`, ChatPage static import weight, near-duplicate money formatters, CITY_PACKS vs city priors.

---

## 4. Dead Code Removed

| Item | Justification |
|------|----------------|
| Entire `src/domains/**` | Zero imports from pages/components/tests |
| `pages/TravelConversation.tsx` | Redirect-only route; page unused |
| `components/DecisionProfile.tsx` | Only used by deleted page |
| `components/LiveSummaryCard.tsx` | Only used by deleted page (`PremiumLiveSummaryCard` remains for `/search`) |
| `utils/rahhalVoice.ts` | Only used by deleted page |
| `lib/security/index.ts` | Call sites use `securityUtils` directly |
| `integrations/providers/index.ts` | Zero importers |
| `integrations/providers/googleMaps/index.ts` | Zero barrel importers (deep imports remain) |
| `integrations/providers/openWeather/index.ts` | Zero barrel importers |
| `formatReply` dead helpers | Zero call sites |

`/travel-conversation` **redirect kept** in `main.tsx`.

---

## 5. Duplicate Logic Removed

- No byte-identical algorithm merges this pass (would risk behavior).
- Doc duplication reduced: `documentation/` folded into `docs/`.
- Identified (not merged yet): multiple `formatMoney*` helpers; Decision Engine `CITY_PACKS` vs Planning Draft priors — tracked as M8/M9.

---

## 6. Refactors Performed

- Architecture docs (`MODULE_MAP`, `ARCHITECTURE_GUIDE`, `DEPENDENCY_GRAPH`, `ROADMAP_TECHNICAL`, `TECHNICAL_DEBT`, `AI_ARCHITECTURE`, `README`) updated to `src/lib` spine.
- Amadeus setup path updated in scripts + `docs/ENVIRONMENT_VARIABLES.md`.
- Root point-in-time reports moved to `docs/history/`.

---

## 7. Architecture Improvements

- Removed incomplete domains migration that invited wrong import guidance.
- Clarified production spine in MODULE_MAP (chat → planTurn → memory/concierge/draft/brain).
- Preserved Recovery freeze contract (`lib/recovery/freeze.ts`).
- `npm run arch:circular` remains **0 cycles**.

---

## 8. Performance Improvements

- Smaller product graph (domains + legacy page cluster gone).
- No runtime hot-path changes (intentionally).

---

## 9. Security Improvements

- No secret handling changes.
- Existing hardening debt documented (C2, H5, H6) without weakening controls.

---

## 10. Documentation Improvements

- Single docs home: `docs/` (+ `docs/history/` for archival).
- Amadeus guide at `docs/AMADEUS_SETUP.md`.
- README product surfaces match redirect reality.
- This report + refreshed debt/roadmap.

---

## 11. Tests Added

- None required for deletion-only cleanup (existing suite is the safety net).
- Full suite must stay green (see verification).

---

## 12. Remaining Technical Debt

See `TECHNICAL_DEBT.md` (H1–H8, M1–M9). Highest leverage next:

1. Thin ChatPage static imports of quarantined stacks.
2. Isolate/archive `lib/payments` + `lib/finance` behind test projects.
3. Proxy RapidAPI secrets server-side.
4. Centralize money formatting / city catalog adapters without behavior change.

---

## 13. Production Readiness Score

**7 / 10**

Ready for continued production hardening; not a greenfield rewrite. AI spine is coherent; repo weight and quarantine leftovers are the main drag.

---

## 14. Recommended next engineering sprint

**“Recovery Phase 2b — Bundle & Quarantine Thinning”**

1. Lazy/dynamic-import ChatPage paths that only serve deprecated flags.
2. Vitest project split for quarantined packages → physical move to `archive/`.
3. Money formatter consolidation (format-preserving).
4. Shared read-only city catalog adapter (Decision Engine + Planning Draft).
5. Edge proxy auth + CORS tightening (security).

Do **not** rewrite Planning Draft, Decision Engine, or Conversation Brain in that sprint.
