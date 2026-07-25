# Merge Order — RC2 GA Review

## Production readiness stack (merge in this order only)

| Order | PR | Branch | Base | Role |
|------:|----|--------|------|------|
| 1 | #277 | `cursor/production-security-secrets-7518` | `main` | SecretManager / security gate |
| 2 | #278 | `cursor/observability-monitoring-7518` | #277 branch | Observability platform |
| 3 | #279 | `cursor/load-testing-resilience-7518` | #278 branch | Load / resilience |
| 4 | #280 | `cursor/production-readiness-audit-7518` | #279 branch | Audit + react-router pin |
| 5 | #281 | `cursor/rc1-validation-7518` | #280 branch | RC1 validation |
| 6 | #282 | `cursor/staging-soak-pre-ga-7518` | #281 branch | Staging soak |
| 7 | RC2 (this) | `cursor/rc2-ga-review-7518` | #282 branch | Final GA review |

**Rule:** Do not squash or reorder. Tip always continues from the previous Draft.

## Parallel Integration drafts (do not interleave)

These still base on `main` and must **not** be merged into the tip stack without a dedicated reconciliation:

#266, #267, #268, #269, #270, #271, #272, #273, #274, #275, #276

## Conflict / hygiene findings

| Check | Status |
|-------|--------|
| Linear stack integrity | PASS |
| Duplicate SecretManager / Observability / Load / Audit / RC1 / Soak packages | PASS (none) |
| Orphaned RC2 review modules | PASS (flagged OFF) |
| Dead critical feature flags enabled by default | PASS (none) |
| Parallel Integration PRs vs tip stack | WARNING — keep separate |
| Merge now | **NO** — program rule: Draft only |

## Dependency note

`react-router@8.3.0` override (Sprint 17) must remain through the stack tip for `npm audit --audit-level=high` = 0.
