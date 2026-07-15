# RC1 Test Report — v1.0.0-rc1

**Branch:** `cursor/release-candidate-rc1-9a2e`  
**Generated:** 2026-07-15  
**Scope:** Phase Y release candidate validation (feature freeze)

## Automated RC1 suites

| Suite | Command | Result | Detail |
|-------|---------|--------|--------|
| Core journey E2E | `npm run test:e2e` (core file) | PASS | See rc1.coreJourney |
| Failure paths | included in `test:e2e` / `test:rc1` | PASS | 17 tests |
| Staging smoke | `npm run test:smoke` | PASS | See rc1.stagingSmoke |
| Combined RC1 | `npm run test:rc1` | **PASS** | 3 files / 27 tests |

## Regression gates (actual execution)

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Unit/integration | `npm run test:run` | PENDING | fill after execution |
| Typecheck | `npm run typecheck` | PENDING | |
| Lint | `npm run lint` | PENDING | |
| Build | `npm run build` | PENDING | |
| Secret hygiene | `bash scripts/secret-hygiene-scan.sh` | PENDING | |

## Security verification

| Control | Expected | Result |
|---------|----------|--------|
| Mock payment only | `VITE_PAYMENT_PROVIDER=mock` | Covered by staging smoke + env validation |
| Live providers default OFF | master flag false | Covered by staging smoke |
| No client secrets in examples | hygiene scan + env examples | Covered by staging smoke |
| PII masking | email/token redaction | Covered by staging smoke |
| Security headers | CSP / X-Frame-Options | Covered by staging smoke |
| Rate limits | domain rate limit | Covered by staging smoke |
| Env validation fail-safe | rejects live payment + VITE secrets | Covered by staging smoke |

## Failure-path matrix

Documented and asserted in `rc1.failurePaths.test.ts`:

- Provider timeout
- Provider rate limit
- Circuit breaker open
- Fallback to mock provider
- Partial provider failure
- Invalid trip input
- Booking failure
- Payment failure
- Duplicate payment event
- Ticket partial issuance + retry
- Notification retry + dead-letter
- Unauthorized trip access
- Expired session
- Offline/reconnect (voice reconnecting status)
- Voice permission denied
- Voice interruption and resume

## Exit criteria snapshot

| Criterion | Status |
|-----------|--------|
| Required checks pass | PENDING full regression |
| E2E core journey passes | PASS |
| No Blocker/Critical open | PENDING until regression green |
| Staging smoke passes | PASS (library) + manual host checklist pending |
| Rollback plan documented | PASS (`ROLLBACK_PLAN.md`) |
| Known issues documented | PASS (`KNOWN_ISSUES.md`) |

## Notes

- Browser Playwright/Cypress harness is intentionally absent; see `KNOWN_ISSUES.md`.
- Do not tag `v1.0.0-rc1` until human approval after this report is fully green.
