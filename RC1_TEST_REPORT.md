# RC1 Test Report — v1.0.0-rc1

**Prepared:** 2026-07-15  
**Package version:** `1.0.0-rc1`  
**Branch:** `cursor/release-candidate-rc1-e7c8`  
**Base:** `main` (includes merged Phase X / PR #39)

## Executive result

| Gate | Command | Result |
|------|---------|--------|
| Unit/integration suite | `npm run test:run` | **PASS** — 84 files, 768 tests |
| Production build | `npm run build` | **PASS** |
| Typecheck | `npm run typecheck` | **PASS** |
| Lint | `npm run lint` | **PASS** (pre-existing warnings only; exit 0) |
| E2E (RC1 journey + failure paths) | `npm run test:e2e` | **PASS** — 2 files, 18 tests |
| Staging smoke | `npm run test:smoke` | **PASS** — 12 tests |
| Dependency audit | `npm run audit` | **PASS** — 0 vulnerabilities |
| Secret hygiene | `bash scripts/secret-hygiene-scan.sh` | **PASS** |

**Do not claim production host smoke sign-off in this report** — live staging URL validation remains a manual step after deploy (`STAGING_SMOKE_TEST.md`).

## E2E core journey (`rc1.journey.e2e.test.ts`)

Validated end-to-end (library orchestration):

- [x] Sign up
- [x] Sign in
- [x] Edit profile and preferences
- [x] Start a text conversation
- [x] Start a voice conversation
- [x] Create a trip request / interactive intake
- [x] Generate a TripPlan
- [x] Search flights
- [x] Search hotels
- [x] Enrich with maps and weather
- [x] Run decision scoring
- [x] Save the trip
- [x] Duplicate and edit (duplicate itinerary)
- [x] Begin mock booking
- [x] Complete mock payment
- [x] Issue mock flight ticket
- [x] Issue mock hotel voucher
- [x] Send mock notifications
- [x] View the trip in My Trips
- [x] Download/retrieve confirmation records
- [x] Cancel a mock booking
- [x] Verify timeline and audit history

## Failure-path suite (`rc1.failurePaths.test.ts`)

| Scenario | Covered |
|----------|---------|
| Provider timeout | Yes |
| Provider rate limit | Yes |
| Circuit breaker open | Yes |
| Fallback to mock provider | Yes |
| Partial provider failure | Yes |
| Invalid trip input | Yes |
| Booking failure (empty readiness) | Yes |
| Payment failure | Yes |
| Duplicate payment event (lock + idempotency) | Yes |
| Ticket partial issuance | Yes |
| Ticket retry | Yes |
| Notification retry / payment-failed notify | Yes |
| Dead-letter handling | Yes |
| Unauthorized trip access | Yes |
| Expired session / auth error mapping | Yes |
| Offline and reconnect behavior (timeout budget) | Yes |
| Voice permission denied | Yes |
| Voice interruption and resume | Yes |

## Staging smoke suite (`rc1.stagingSmoke.test.ts`)

| Check | Result |
|-------|--------|
| App static probes (`health.json` / `ready.json`) | PASS |
| Auth-capable env validation / startup | PASS |
| Database access contracts (via journey orch.) | PASS (library) |
| Edge Functions respond (ops-health source + probe contract) | PASS (source/contract) |
| Health endpoint | PASS |
| Readiness endpoint | PASS |
| Mock payment remains active | PASS |
| Live providers remain off unless enabled | PASS |
| No client secret assignments in templates | PASS |
| Core user journey completes | PASS |

## Security verification

| Check | Result |
|-------|--------|
| No secrets committed (hygiene scan) | PASS |
| No provider keys in client env templates | PASS |
| Dist scan for obvious secret patterns post-build | PASS (no hits) |
| PII masking works | PASS (smoke + ops tests) |
| Security headers active | PASS (`SECURITY_HEADERS` + `public/_headers`) |
| Rate limits active | PASS |
| Environment validation fails safely | PASS |
| Live providers default OFF | PASS |
| Mock payment only enabled mode | PASS |

## Release blockers

See `RELEASE_BLOCKERS.md`. **No Blocker or Critical issues open** against library RC1 exit criteria.

Open Major (accepted for RC1, not merge blockers for this PR):

- Browser Playwright suite not yet present
- Live staging host manual sign-off pending deploy

## Exit criteria checklist

- [x] Required checks pass (executed locally as reported above)
- [x] E2E core journey passes
- [x] No Blocker or Critical unresolved
- [x] Staging smoke suite passes (automated)
- [x] Rollback plan documented (`ROLLBACK_PLAN.md`)
- [x] Known issues documented honestly (`KNOWN_ISSUES.md`)
- [ ] Human approval to tag/release RC1 — **waiting**

## Notes

- Feature freeze honored: no new product features, no UI redesign, no rename, payments remain mock.
- Production `v1.0.0` tag/release is **not** part of this phase.
