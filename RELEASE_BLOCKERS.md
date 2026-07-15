# Release Blockers — v1.0.0-rc1

Do **not** merge or promote RC1 while any **Blocker** or **Critical** item remains unresolved.

Severity guide:

| Severity | Meaning |
|----------|---------|
| **Blocker** | Prevents release candidacy; must fix immediately |
| **Critical** | High user/security/data risk; must fix before RC1 ready |
| **Major** | Significant gap; may ship RC1 with documented mitigation |
| **Minor** | Cosmetic or low-impact; track for GA |

## Current status

| ID | Severity | Issue | Status | Notes |
|----|----------|-------|--------|-------|
| RB-01 | Blocker | `npm run test:run` failing | **Resolved** | 84 files / 765 tests PASS |
| RB-02 | Blocker | `npm run build` failing | **Resolved** | Vite production build PASS |
| RB-03 | Blocker | `npm run typecheck` failing | **Resolved** | `tsc -b` PASS |
| RB-04 | Blocker | `npm run lint` failing | **Resolved** | oxlint exit 0 (pre-existing warnings only) |
| RB-05 | Critical | RC1 core journey E2E failing | **Resolved** | `npm run test:e2e` / `test:rc1` PASS |
| RB-06 | Critical | Staging smoke suite failing | **Resolved** | `npm run test:smoke` PASS |
| RB-07 | Critical | Live payment enabled in staging/prod config | **Mitigated** | Env validation + readiness force mock |
| RB-08 | Critical | Client bundle/env secrets present | **Mitigated** | Hygiene scan PASS; dist only contains scanner key *names*/regexes from ops code, not assigned secret values |
| RB-09 | Major | No Playwright browser E2E | **Accepted for RC1** | Documented in `KNOWN_ISSUES.md` |
| RB-10 | Major | Deployed staging ops-health not auto-gated in CI | **Accepted for RC1** | Manual `STAGING_SMOKE_TEST.md` |
| RB-11 | Minor | Voice device variance outside CI | **Accepted** | Mock coverage present |

## Gate rule

RC1 is ready only when:

- All Blocker and Critical rows are **Resolved** or **Mitigated** with evidence in `RC1_TEST_REPORT.md`
- Regression checks in `RC1_TEST_REPORT.md` show actual passing executions
- Rollback plan is documented (`ROLLBACK_PLAN.md`)

**Local gate:** satisfied. **`v1.0.0-rc1` was released as a prerelease and promoted to stable `v1.0.0` after RC1 validation sign-off.**
