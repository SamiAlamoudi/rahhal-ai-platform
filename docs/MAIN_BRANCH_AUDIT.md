# Main Branch Audit

**Date:** 2026-07-21  
**Audited ref:** `origin/main` @ `15e3a293a1031298ce4667efef3ff6aa561828c1`  
**HEAD message:** `feat(hotels): Sprint 73 — Hotel Search Engine (Production Ready) (#148)`  
**Package version:** `1.1.0-rc.1`  
**Product GA version (manifest):** `1.0.0`  
**Scope:** Read-only audit. No architecture changes. No feature work.

## Verdict

**FAIL** — main is **CI-green and merge-complete** for the recent production stack (Sprints 65–73 / PRs #140–#148), but it is **not production-clean** against the full audit checklist.

Primary blockers: orphan UI/hook modules (~1.1k LOC never imported by the app), and conflicting / lagged release documentation.

---

## Validation gates (executed)

| Command | Result |
|---------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:run` | PASS — 179 files, 1958 tests |
| `npm run build` | PASS (chunk-size warning only; non-blocking) |
| `npm run arch:circular` | PASS — no circular dependencies under `src/` |

---

## Checklist results

### 1. Merged pull requests present on main

**PASS**

Squash-merge commits for Sprints 65–73 are ancestors of `main`:

| PR | Sprint | Present |
|----|--------|---------|
| #140 | 65 Production Hardening | yes |
| #141 | 66 E2E Validation | yes |
| #142 | 67 Beta Launch | yes |
| #143 | 68 Deployment | yes |
| #144 | 69 Operations | yes |
| #145 | 70 GA Release | yes |
| #146 | 71 Provider Runtime | yes |
| #147 | 72 Flight Search Engine | yes |
| #148 | 73 Hotel Search Engine | yes |

Spot-check of earlier merged PRs (#111, #134–#139) also present in `main` history.

### 2. Duplicated implementations

**PASS (by design / layered)**

No byte-identical duplicate source or test files under `src/`.

Intentional parallel layers (not clones):

- `liveProviders` (`simulated`) vs `providerRuntime` (`mock`) — different ID namespaces for different layers.
- Rank / dedupe / pagination in `aggregation`, `bookingIntelligence`, `flightSearchEngine`, `hotelSearchEngine` — additive engines with local pipelines.
- Legacy `src/lib/hotels` (incl. `hotelbedsAdapter`) vs Sprint 73 `hotelSearchEngine` + `hotelbedsFuture` stub — separate surfaces; Hotelbeds is not a Provider Runtime ID.

### 3. Dead code

**FAIL**

App-reachable code is largely healthy, but the following modules have **no importers outside themselves** (static graph + name search; not lazy-loaded):

| Area | Paths | Notes |
|------|-------|-------|
| Brain debug UI | `src/components/brain/**` | Entire tree unused by pages/features |
| Voice chrome UI | `src/components/voice/**` | Entire tree unused (voice **libs** are used via Chat) |
| Orphan hooks | `useConversationBrain`, `useConversationMemory`, `useTravelContext`, `useVoiceConversation`, `useVoiceEvents`, `useVoiceState` | Documented in sprint markdown only |

Approx. **~1,100 LOC** of orphan UI/hooks. False positives excluded: `DecisionDashboard` / `ResultsExperience` (lazy imports), `viteAmadeusApiPlugin` (imported from `vite.config.ts`).

### 4. Orphan modules

**FAIL** — same set as dead code above (barrels `components/brain/index.ts`, `components/voice/index.ts` never imported).

### 5. Unused exports

**FAIL** — all exports from the orphan brain/voice barrels and the six hooks are unused by the application graph.

No automated knip/ts-prune in the repo; assessment is static import-graph based. A full unused-export sweep of every barrel export was not claimed.

### 6. Duplicated tests

**PASS**

No identical test-file hashes. Sprint suites are distinct (`*.sprint70` … `*.sprint73`, etc.).

### 7. Provider runtime inconsistencies

**PASS (with notes)**

- Feature flags default **OFF**: `ai.live_providers`, `provider.amadeus`, `provider.duffel`, `provider.booking`, `payments.live`, `providers.live_master`.
- Runtime correctly falls back to mock when flags/secrets missing.
- Dual master flags (`ai.live_providers` + `providers.live_master`) are registered and documented in `docs/FEATURE_MATRIX_V1.md` — both OFF for prod V1.
- ID naming: `LiveProviderId` uses `simulated`; `ProviderRuntimeId` uses `mock`. Layered, not a broken mapping at runtime.

### 8. Circular dependencies

**PASS** — `npm run arch:circular` clean. (Historical Sprint 70 fix: rollback imports `patchRelease` directly, not the GA barrel.)

### 9. Feature flags inconsistent state

**PASS**

Critical live/payment flags default OFF and are audited by production/deployment helpers. Dual master-flag naming is intentional, not a split-brain default.

### 10. `package.json` script conflicts

**PASS**

32 unique script keys; no duplicate keys. Verify scripts coexist without collision: `beta:verify`, `ops:verify`, `ga:verify`, `runtime:verify`, `flights:verify`, `hotels:verify`, `deploy:verify`, `production:verify`, `preview:verify`.

### 11. Environment key conflicts

**PASS**

`.env.example` has 38 assigned keys; no duplicate key assignments. `VITE_PAYMENT_PROVIDER=mock` consistent with production docs. Server secrets remain non-`VITE_*` for Amadeus/Duffel.

### 12. Documentation conflicts

**FAIL**

| Issue | Detail |
|-------|--------|
| Multiple release-note roots | Root `RELEASE_NOTES.md` (v1.0.1 patch), root `RELEASE_NOTES_v1.md` (RC1 / Sprint 44 framing), `docs/RELEASE_NOTES_V1.md` (GA Sprint 70) — conflicting “what is V1” narratives |
| CHANGELOG lag | `docs/CHANGELOG_V1.md` / `docs/RELEASE_NOTES_V1.md` stop at Sprint 70; Sprints 71–73 exist only as `docs/SPRINT71_*.md` … `SPRINT73_*.md` |
| Package vs product version | Documented intentionally (`1.1.0-rc.1` package vs `1.0.0` GA) — **not** a conflict by itself |

---

## Module presence (Sprints 65–73)

| Module | Path | Tests |
|--------|------|-------|
| Production hardening | `src/lib/ops/production/` | present |
| Validation | `src/lib/ops/validation/` | present |
| Beta | `src/lib/ops/beta/` | present |
| Deployment | `src/lib/ops/deployment/` | present |
| Operations | `src/lib/ops/operations/` | present |
| GA release | `src/lib/ops/release/` | present |
| Provider Runtime | `src/lib/agent/providerRuntime/` | `providerRuntime.sprint71.test.ts` |
| Flight Search Engine | `src/lib/agent/flightSearchEngine/` | `flightSearch.sprint72.test.ts` |
| Hotel Search Engine | `src/lib/agent/hotelSearchEngine/` | `hotelSearch.sprint73.test.ts` |

---

## What is healthy

- Full unit/lint/type/build/circular gate suite green on default (mock) env.
- Recent production/ops/provider search stack merged and present.
- Safe production defaults for live providers and payments.
- No exact duplicate implementations or duplicate tests.
- No circular deps; no package/env key collisions.

## What blocks PASS

1. Orphan / dead UI + hooks (`components/brain`, `components/voice`, six unused hooks).
2. Conflicting and lagged release documentation trees.

Remediation (out of scope for this audit): delete or wire orphans; consolidate release notes / changelog through Sprint 73. Do **not** rewrite engines to “clean” the tree.

---

## Summary table

| Check | Status |
|-------|--------|
| Merged PRs on main | PASS |
| No duplicated implementations | PASS |
| No dead code | **FAIL** |
| No orphan modules | **FAIL** |
| No unused exports | **FAIL** |
| No duplicated tests | PASS |
| Provider runtime consistency | PASS |
| No circular dependencies | PASS |
| Feature flags consistent | PASS |
| package.json scripts | PASS |
| Environment keys | PASS |
| Documentation | **FAIL** |
| lint / typecheck / test / build / arch:circular | PASS |

**Overall: FAIL**
