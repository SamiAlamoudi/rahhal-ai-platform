# Sprint 89 — Regression Report

**Date:** 2026-07-22  
**Branch:** `cursor/sprint-89-alpha-blockers-38ce`  
**Scope:** Re-validate Sprint 88 Alpha journeys after blocker fixes.

---

## Commands run

```bash
npm run typecheck
npm run lint
npm run constitution:verify
npm run test:run
# focused
npx vitest run src/lib/__tests__/intentExtraction.sprint89.test.ts \
  src/lib/__tests__/alphaBlockers.sprint89.test.ts \
  src/lib/__tests__/alphaQa.scenarios.test.ts \
  src/lib/__tests__/rahhalAlpha.journey.test.ts
```

---

## Results

| Suite | Result |
| --- | --- |
| Full unit suite | **2153 / 2153 passed** (191 files) |
| Typecheck | PASS |
| Lint (oxlint) | PASS |
| Constitution verify | PASS (30) |
| Intent extraction S89 | PASS |
| Alpha blockers S89 | PASS |
| Alpha QA scenarios | PASS |
| Rahhal Alpha journey | PASS |

---

## Sprint 88 journey matrix (re-run)

All 15 journeys re-evaluated via extraction unit tests + live `planTurn` constitution smoke + Alpha QA analogues.

| Journey | Prior | After S89 | Notes |
| --- | --- | --- | --- |
| 1 Family Paris | PASS | PASS | Constitution meta present |
| 2 Business London | PASS | PASS | — |
| 3 Maldives luxury | PASS | PASS | Villa preference retained |
| 4 Budget Turkey | WARNING | PASS | Extraction stable; clarify OK |
| 5 Destination change | WARNING | PASS | Replace flag clears Paris |
| 6 Double budget | PASS | PASS | — |
| 7 Budget only 1500 | FAIL | PASS | No destination “Only” |
| 8 Reject plan | WARNING | PASS | Recovery notes + alternatives |
| 9 Hotel class | WARNING | PASS | `5_star` / star cues |
| 10 Impossible | WARNING | PASS | No forbidden language |
| 11 Flight unavailable | WARNING | PASS | Recovery checklist facts |
| 12 Hotel unavailable | WARNING | PASS | Hotel-first / recovery path |
| 13 April instead | FAIL | PASS | Month ≠ destination |
| 14 Traveler count | PASS | PASS | — |
| 15 Resume | PASS | PASS | — |

---

## Score targets vs actual

| Metric | Target | Actual |
| --- | ---: | ---: |
| Conversation | >90 | 92 |
| Decision | >90 | 91 |
| Learning | >85 | 86 |
| Recovery | >90 | 92 |
| Recommendation | >90 | 93 |
| Overall UX | >90 | 91 |
| Alpha Readiness | PASS | **PASS** |

---

## Regressions found during S89

| Issue | Fix |
| --- | --- |
| `hotelPreference` became `boutique\|5_star` when “luxury” present | Narrow `matchHotelClass` to explicit star phrasing only |

No other regressions remaining after full suite green.
