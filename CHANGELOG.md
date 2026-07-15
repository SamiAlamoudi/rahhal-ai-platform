# Changelog

All notable changes to Rahhal are documented in this file.

## [1.0.0-rc1] — 2026-07-15

### Added

- RC1 end-to-end core journey coverage (`rc1.coreJourney.test.ts`) spanning auth, chat/voice, trip intake, aggregation, decision scoring, My Trips, mock booking/payment/ticketing/notifications, cancel, and audit timeline.
- RC1 failure-path suite (`rc1.failurePaths.test.ts`) for timeouts, rate limits, circuit breaker, mock fallback, partial failures, payment/booking/ticket/notification retries, DLQ, unauthorized access, expired session, offline reconnect, and voice permission/interrupt.
- RC1 staging smoke suite (`rc1.stagingSmoke.test.ts`) for health/readiness, mock payment, live-provider defaults, env validation, secret hygiene, security headers, masking, and rate limits.
- Release artifacts: `RELEASE_NOTES.md`, `RC1_TEST_REPORT.md`, `KNOWN_ISSUES.md`, `RELEASE_BLOCKERS.md`, `STAGING_SMOKE_TEST.md`, `ROLLBACK_PLAN.md`.
- npm scripts: `test:e2e`, `test:smoke`, `test:rc1`.

### Changed

- Package version set to `1.0.0-rc1` (release candidate; not final production `1.0.0`).

### Security

- Confirmed mock payment is the only enabled payment mode for RC1.
- Confirmed live travel providers remain disabled by default.
- Staging smoke verifies no client secret assignments in example env files and active security headers / PII masking / rate limits.

### Notes

- Feature freeze: RC1 includes test/docs/hardening validation only — no new product features, UI redesign, or project rename.
- Do not tag or promote to production until RC1 exit criteria are met and explicit approval is granted.
