# Release Blockers — v1.0.0-rc1

Severity scale:

- **Blocker** — Cannot ship RC1 / cannot promote toward production
- **Critical** — Must fix before RC1 approval
- **Major** — Should fix before production `v1.0.0`; allowed in RC1 with owner
- **Minor** — Polish / follow-up

## Policy

**Do not merge RC1 while any Blocker or Critical issue remains unresolved.**  
**Do not tag/release RC1 without human approval.**

## Current register (as of RC1 prep)

| ID | Severity | Issue | Status | Notes |
|----|----------|-------|--------|-------|
| RB-01 | — | Open Blocker/Critical defects from RC1 suites | **None open** | Library E2E, failure-path, and smoke suites pass locally |
| RB-02 | Major | No browser Playwright/Cypress E2E harness yet | Accepted for RC1 | Covered by Vitest library journey (`npm run test:e2e`) |
| RB-03 | Major | Staging host manual smoke not yet signed on a live URL in this agent run | Open | Execute `docs/STAGING_SMOKE_TEST.md` on staging after deploy |
| RB-04 | Minor | Branding TODOs remain (`docs/BRANDING_TODO.md`) | Accepted | Outside RC1 feature freeze |
| RB-05 | Minor | Payment production freeze still in force | By design | `docs/PAYMENT_PRODUCTION_TODO.md` |

## Exit rule

RC1 is mergeable only when:

1. Required checks pass (`typecheck`, `lint`, `test:run`, `build`, secret hygiene)
2. `npm run test:rc1` passes
3. No Blocker or Critical rows are Open
4. Rollback plan documented (`ROLLBACK_PLAN.md`)
5. Known issues documented honestly (`KNOWN_ISSUES.md`)
