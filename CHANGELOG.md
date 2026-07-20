# Changelog

All notable changes to Rahhal are documented in this file.

## [Unreleased] — Sprint 46: Smart Clarification / Never-Ask-Twice

### Added

- Soft preference inference on the production agent path (`ai.smart_clarification`, default ON).
- Hard-only clarification gates: destination / duration / budget / travelers; interests, weather, hotel, package, budget style, and traveler type are inferred.
- Docs: `docs/SPRINT46_SMART_CLARIFICATION.md`; tests: `smartClarification.sprint46.test.ts`.

## [Unreleased] — Sprint 45: Autonomous Travel Reasoning Engine

### Added

- Open-ended destination discovery on the production `/chat` agent path (`ai.travel_reasoning`, default ON).
- Deterministic climate × budget × visa reasoning catalog with explainable recommendations (AR/EN).
- Preference memory bridge: seed empty intake slots from `PreferenceEngine` and learn stated preferences back (never overwrite).
- `destinationFlexible` intake + Concierge policy so the agent proposes destinations instead of asking “where?”.
- Docs: `docs/SPRINT45_TRAVEL_REASONING.md`; tests: `travelReasoning.sprint45.test.ts`.

## [1.1.0-rc.1] — 2026-07-20

### Stabilization (no new product features)

- Repository cleanup: removed agent batch push artifacts, unused components/pages, duplicate scoring/report utils, unused `@vitest/ui`.
- Quality: typecheck / lint (0 warnings) / 1600 Vitest tests / production build all green.
- Performance: route-level `React.lazy` code-splitting + vendor chunks (entry JS ~24 kB vs prior ~2 MB monolith).
- Security: coupons RLS SELECT-only for authenticated; Moyasar webhook header-only secrets; chat media URL allowlist; RapidAPI `VITE_*` warnings on hardened targets; session persist timer cleanup.
- Docs: `RELEASE_NOTES_v1.md`, `PRODUCTION_CHECKLIST.md`, `RC_STABILIZATION_REPORT.md`; README / AI architecture / feature registry refreshed.

### Included from main (already merged)

- Sprint 42 Conversation Experience & Booking UX (`ui.conversation_experience`, default OFF).
- Sprint 43 Rahhal AI Orchestrator (`brain.ai_orchestrator`, default OFF).
- Sprint 44 ChatGPT-like conversation experience (`ui.chatgpt_experience`, default OFF).

## [Unreleased] — Production MVP: Preview deployment readiness

### Added

- Preview deploy target + `verifyPreviewEnvironment()` / `npm run preview:verify` (mock payment, live providers OFF, Supabase required).
- `.env.preview.example`, `npm run build:preview`, docs `docs/PREVIEW_DEPLOYMENT.md`.
- GitHub workflow **Preview readiness** — env verify, preview build, providers check, Playwright, uploads `preview-dist` artifact (no production deploy).

## [Unreleased] — Production MVP: Browser E2E (Playwright)

### Added

- Playwright Chromium funnel spec: login (demo) → search → results → booking review → checkout → payment preparation.
- `npm run build:e2e` / `npm run test:playwright` (demo auth + mock providers; production behavior unchanged).
- CI job **Browser E2E (Playwright)** after quality gates; uploads report on failure.
- Stable `data-testid` hooks on funnel CTAs (no product behavior change).

## [Unreleased] — Production MVP: My Trips lifecycle

### Added

- My Trips durable **cancel** (`إلغاء الحجز`) via `cancelBookingSession` + `syncBookingSession`.
- Resume/cancel eligibility helpers (`myTripsActions.ts`) with unit coverage.

## [Unreleased] — Production MVP: Amadeus Sandbox

### Added

- Amadeus sandbox funnel wiring: `bookingUrl` on flight offers, `amadeusSandbox` readiness helpers, default sandbox host for Amadeus flight adapter.
- `liveSearchOrchestrator` passes Amadeus `bookingUrl` / offer id into results metadata for BookingReview.
- Docs: `docs/AMADEUS_SANDBOX.md` staging pilot checklist (opt-in; mock remains default).

## [Unreleased] — Production MVP: unified booking funnel

### Added

- Results → BookingReview selection hop (`bookingSelectionMapper`, select CTAs on results cards).
- TravelConversation / SearchWorkspace open full results with `travelSessionId`.
- BookingReview exit: provider redirect **or** Rahhal checkout via `prepareBookingPayment`.

## [Unreleased] — Production MVP: booking persistence (production-ready)

### Added

- Durable booking session persistence (`bookingPersistence.ts`): Supabase write-through + per-user local cache fallback.
- `BookingOrchestrator.importSession` / `replaceUserSessions` for hydrate-after-reload.
- My Trips loads real persisted booking records for the signed-in user.
- Booking review/return resume persisted sessions and sync status changes.

### Security / hardening

- Local cache keyed per `userId` (no cross-user leakage on shared browsers).
- `loadBookingSession(sessionId, userId)` enforces ownership before hydrate.
- BookingReview / BookingReturn wait for auth and never persist as `'anonymous'`.
- Sync upserts: update then create-if-missing (offline-first create path).

## [Unreleased] — Phase AB

### Added

- v1.1 AI enhancement foundation (`src/lib/ai/**`): FeatureRegistry, PreferenceEngine, RankingEngine, RecommendationEngine, planning helpers, anonymous ProductAnalytics.
- Docs: `V1_1_ROADMAP.md`, `FEATURE_REGISTRY.md`, `AI_ARCHITECTURE.md`.
- Suite: `npm run test:ai` (`ai.phaseAB.test.ts`).
- No UI redesign; payments and live providers remain mock/OFF.

## [Unreleased] — Phase AA

### Added

- Post-launch monitoring snapshot (`collectMonitoringSnapshot`) and signal recorders.
- Provider-neutral alerting (`evaluateAlertRules`, `MockAlertDispatcher`).
- Incident lifecycle manager + feedback repository (PII-masked support views).
- Patch-release / rollback decision helpers (`evaluatePatchRelease`).
- Post-release verification suite: `npm run test:post-release`.
- Ops runbooks: monitoring, alerting matrix, hotfix, incident template, customer support, post-release checklist.

## [1.0.1] — 2026-07-16

### Fixed

- Restored the missing `npm run providers:check` quality gate (merged via PR #56).
- Added explicit **Providers check** step to GitHub Actions CI (after unit tests, before build).
- Implemented config-only provider readiness validation using existing Phase W/X APIs:
  - requires `VITE_PAYMENT_PROVIDER=mock`
  - requires live providers master switch OFF by default
  - requires mock fallback ON by default
  - performs no network probes in the default path
- Added failure-path coverage for non-mock payment and forbidden client-side secret env keys.

### Notes

- Patch/tooling release only — no application features, no UI changes, no API/DB contract changes.
- Does **not** enable live travel providers.
- Does **not** change payment behavior (mock remains the only enabled mode).
- Package version set to `1.0.1`.

## [1.0.0] — 2026-07-15

### Released

- First stable production release of Rahhal AI Platform.
- Promoted from validated `v1.0.0-rc1` after RC1 exit criteria passed.

### Includes (from RC1 validation freeze)

- End-to-end core journey coverage (auth, chat/voice, trip intake, TripPlan, aggregation, decision scoring, My Trips, mock booking/payment/ticketing/notifications, cancel, timeline/audit).
- Failure-path and resilience suites (timeouts, rate limits, circuit breaker, mock fallback, partial failures, retries, DLQ, unauthorized access, expired session, voice denied/interrupt/reconnect).
- Staging smoke suite (health/readiness, mock payment, live-provider defaults OFF, env validation, secret hygiene, security headers, PII masking, rate limits).
- Release operations artifacts: test report, known issues, blockers checklist, staging smoke checklist, rollback plan.
- Production-hardening ops controls from Phase X (still active in v1.0.0).

### Security posture

- `VITE_PAYMENT_PROVIDER=mock` remains the only enabled payment mode.
- Live travel providers remain disabled by default.
- Client bundles must not carry provider secrets; secret hygiene scan is part of CI.

### Changed

- Package version set to `1.0.0`.

## [1.0.0-rc1] — 2026-07-15

### Added

- RC1 end-to-end core journey coverage (`rc1.coreJourney.test.ts`).
- RC1 failure-path suite (`rc1.failurePaths.test.ts`).
- RC1 staging smoke suite (`rc1.stagingSmoke.test.ts`).
- Release artifacts for RC1 validation.
- npm scripts: `test:e2e`, `test:smoke`, `test:rc1`.

### Notes

- Release candidate for staging validation; subsequently promoted to `v1.0.0`.
