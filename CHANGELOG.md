# Changelog

All notable changes to Rahhal are documented in this file.

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
