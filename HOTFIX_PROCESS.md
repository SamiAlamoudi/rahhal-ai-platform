# Hotfix Process — Rahhal AI Platform

## When to use

| Trigger | Action |
|---------|--------|
| Critical availability or security alert | Emergency hotfix or rollback (see `evaluatePatchRelease`) |
| High-severity booking/payment/ticketing spike | `v1.0.1` patch |
| Medium/low alerts, open incidents | Monitor; triage via `IncidentManager` |
| No alerts, healthy probes | No-action monitoring |

## Steps

1. Confirm signal in `collectMonitoringSnapshot()` and `evaluateAlertRules()`.
2. Open or update an incident (`Detected → Investigating`).
3. Capture correlation IDs from structured logs.
4. Branch: `cursor/hotfix-<slug>-9a2e` off `main`.
5. Minimal fix only — no feature work, no UI redesign.
6. Run: `npm run test:run`, `npm run test:post-release`, `npm run typecheck`, `npm run lint`, `npm run build`.
7. Open one PR; wait for CI green.
8. Deploy; re-run post-release verification.
9. Transition incident to `Resolved → Closed` with root cause and follow-ups.

## Constraints (always)

- `VITE_PAYMENT_PROVIDER=mock`
- Live providers remain OFF unless explicitly approved
- Preserve public APIs and database contracts
- Mask PII in incidents and feedback

## Rollback vs hotfix

- **Rollback** when readiness/availability critical or secret validation fails.
- **Hotfix** when critical but fixable without full redeploy of last-good artifact.
- See `ROLLBACK_PLAN.md`.
