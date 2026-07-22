# Sprint 95 — Release Readiness Report

**Type:** Release stabilization & CI/CD hardening (no product features)  
**Base:** `origin/main` @ `0af934e` (Sprint 92 merged)  
**Scope:** Hygiene, deployment reliability, CI gates, audits only

---

## 1. Merge / temporary code audit (Sprints 91–94)

| Area | Finding | Action |
|------|---------|--------|
| Conflict markers | None in tree | — |
| Obsolete merge TODOs/FIXMEs | None related to S91–94 merges | — |
| `toBookableTrip` | Live Booking Orchestrator entry normalization | **Kept** (required) |
| `toUnifiedTripFlightOffer` / `toBookableFlightSegment` | Amadeus → Trip / BookableTrip adapters | **Kept** (referenced + documented) |
| `BookableTrip` structural type | Backward-compatible booking input | **Kept** (compat policy) |
| Duplicate barrel exports | Additive `export *` from trip / booking / alpha / amadeus | **Kept** (no exact duplicates to delete) |
| Dead adapters | None unreferenced | — |

No obsolete compatibility shims were safe to remove without breaking S93↔S94 or Amadeus bridges.

---

## 2. Architecture modules (`src/core`)

| Module | Role |
|--------|------|
| `decisionEngine` + planner/scoring/ranking | Autonomous search & decision |
| `profile` / `learning` | Adaptive learning |
| `priceIntelligence` | Timing / price confidence |
| `packageBuilder` | Dynamic packages |
| `itineraryRefinement` | Constraint refinement |
| `constitution` | AI behavioral governance |
| `providers` | Provider readiness (registry, retry, CB, health) |
| `amadeusSandbox` | First live TravelProvider (sandbox flights) |
| `trip` | Unified Travel Intelligence (TripComposer) |
| `alphaExperience` | Production Alpha conversation orchestration |
| `booking` | Live Booking Orchestrator |
| `observability` | Decision events |

**Core TypeScript files under `src/core`:** 126  
**Agent feature packages under `src/lib/agent` (depth≤2):** 36 directories

---

## 3. Active feature flags (registry)

**Total registered flags:** 99

Sprint 91–94 product flags (default **enabled** unless noted):

| Flag | Sprint | Default |
|------|--------|---------|
| `ai.alpha_experience` | 91 | ON |
| `providers.amadeus.enabled` / `provider.amadeus` | 92 | Sandbox ON / prod-sensitive |
| `ai.unified_trip` | 93 | ON |
| `booking.orchestrator` | 94 | ON |
| `ai.constitution` | 87 | ON |
| Provider readiness / live master | 90 / live layer | Mock-safe defaults |

Full matrix: `src/lib/ai/featureFlags/featureRegistry.ts`.

---

## 4. Subsystem readiness

| Subsystem | Status | Verify |
|-----------|--------|--------|
| Provider readiness | Ready (infra + mocks) | `npm run providers-readiness:verify` |
| Amadeus Sandbox | Ready (flights only; hotels OOS) | `npm run amadeus-sandbox:verify` |
| Unified Trip | Ready | `npm run unified-trip:verify` |
| Alpha Experience | Ready | `npm run alpha-experience:verify` |
| Booking Orchestrator | Ready (placeholders for hotel/transfer/insurance) | `npm run booking-orchestrator:verify` |
| AI engines (Decision, Learning, Price, Packages, Refinement, Constitution) | Ready | respective `*:verify` scripts |

---

## 5. AI engines available

1. Conversation / agent service path  
2. Constitution validators  
3. Search planner + Decision Engine  
4. Adaptive Learning  
5. Price Intelligence  
6. Dynamic Package Builder  
7. Itinerary Refinement  
8. Unified Trip Composer (presentation)  
9. Alpha Experience Orchestrator (presentation)  
10. Booking Orchestrator (execution workflow)  
11. Legacy booking execution / trip management / payments (feature-flagged; unchanged this sprint)

---

## 6. CI pipeline (every PR)

Workflows on `pull_request`:

| Workflow | Install | Lint | Typecheck | Build | Test |
|----------|---------|------|-----------|-------|------|
| **CI — Quality gates** | `npm ci` | ✅ | ✅ | ✅ | `npm run test` |
| **Preview readiness** | `npm ci` | — | — | `build:preview` | Playwright |
| **Production Deployment Readiness** | `npm ci` | ✅ | ✅ | ✅ | `npm run test` |

Also on CI quality: `arch:circular`, `providers:check`, `npm run audit` (fail-closed).

**Hardening in Sprint 95:**

- Concurrency groups cancel stale runs on the same ref  
- `npm test` is non-watch (`vitest run`)  
- Vercel `installCommand: npm ci`  

---

## 7. GitHub branch protection readiness (report only)

Compatible check names for required status checks:

1. `Quality gates` (CI)  
2. `Browser E2E (Playwright)` (CI)  
3. `Preview build & verify`  
4. `Production deployment gates`  
5. `Vercel` (deployment status)

Recommended settings (do **not** apply via this sprint):

- Require status checks to pass before merging  
- Require branches to be up to date before merging  
- Do not allow merge when build fails  

API note: branch protection settings were not readable with the agent token (403); readiness is based on workflow job names above.

---

## 8. Vercel deployment stability

| Check | Result |
|-------|--------|
| Production alias | `rahhal-ai-platform.vercel.app` |
| Last known production deploy | `dpl_B8mJH42s2Uw3tKQNyikrWbBJFWeK` — **Ready**, branch **main**, commit **`0af934e`** |
| Stale failure source | Preview of `ce8504e` on `cursor/sprint-93-unified-trip-38ce` (`budget` fixture) — superseded |
| Lockfile | `installCommand: npm ci` in `vercel.json` |
| Cache assumptions | Redeploys can skip cache; CI does not rely on Vercel cache |

---

## 9. Dependency audit

| Check | Result |
|-------|--------|
| Declared deps | Lean SPA set (React 19, Vite 8, Vitest, Supabase, Tailwind, Playwright) |
| Circular imports (`src/`) | **None** (`npm run arch:circular`) |
| Duplicate exports | Additive barrels only; no exact-duplicate removals required |
| Unused packages | None removed (would risk tooling bindings) |
| Extraneous node_modules | Optional native bindings from tooling — not committed |

---

## 10. Production verification commands

```bash
npm run lint
npm run typecheck
npm run build
npm run test
# optional composite:
npm run release:verify
```

---

## 11. Technical debt (non-blocking for Sprint 96)

1. Live hotel providers still out of Amadeus Sandbox scope  
2. Booking Orchestrator hotel/transfer/insurance remain placeholders  
3. Payments stay mock-default until payment TODO complete (`docs/RELEASE_CHECKLIST.md`)  
4. Large `ChatPage` chunk size (bundle warning only)  
5. Branch protection must be enabled manually by a repo admin  
6. Dual Amadeus flags (`provider.amadeus` + `providers.amadeus.enabled`) — intentional aliases  

**No blockers** for starting Sprint 96 from a stability perspective, assuming branch protection is configured and production env secrets remain mock-safe for live providers.

---

## 12. Recommendation

**Rahhal is ready to start Sprint 96** after this PR merges and CI + Vercel production stay green on the merge commit.
