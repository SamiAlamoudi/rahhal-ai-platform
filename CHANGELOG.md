# Changelog

All notable changes to Rahhal are documented in this file.

## [1.0.0-rc1] — 2026-07-15

### Added

- Phase Y RC1 library E2E journey covering auth, preferences, text/voice chat, trip intake, TripPlan, mock search enrichment, decision scoring, save/duplicate, mock booking/payment/ticketing/notifications, My Trips, confirmation retrieval, cancel, and timeline/audit.
- RC1 failure-path suite: provider timeout, rate limit, circuit breaker, mock fallback, partial failure, invalid trip input, booking/payment/ticket/notification failures, duplicate payment lock, ticket retry, dead-letter handling, unauthorized trip access, expired/auth mapping, offline/reconnect budgets, voice permission denied, voice interrupt/resume.
- Repeatable staging smoke suite (`npm run test:smoke`) for health/ready probes, env safety, security headers, PII masking, rate limits, mock payment freeze, live providers OFF, and compressed core journey.
- Release artifacts: `RELEASE_NOTES.md`, `RC1_TEST_REPORT.md`, `KNOWN_ISSUES.md`, `RELEASE_BLOCKERS.md`, `STAGING_SMOKE_TEST.md`, `ROLLBACK_PLAN.md`.

### Changed

- Package version set to `1.0.0-rc1` (release candidate only; production `v1.0.0` not tagged).
- Added npm scripts: `test:e2e`, `test:smoke`, `test:rc1`.

### Security

- Confirmed mock payment default (`VITE_PAYMENT_PROVIDER=mock`) in `.env.example`, `.env.staging.example`, `.env.production.example`.
- Live providers remain disabled by default (`VITE_LIVE_PROVIDERS_ENABLED=false`).
- No new client-side provider secrets; CI secret hygiene scan retained.

### Notes

- Feature freeze for RC1: no new product features, no UI redesign, no project rename, no live payments.
- Do not promote RC1 to production until Blocker/Critical checklist is empty and human approval is granted for tagging.
