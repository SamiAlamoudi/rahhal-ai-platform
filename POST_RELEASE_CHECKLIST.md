# Post-Release Checklist — v1.0.0+

Run after every production or staging promotion.

## Automated (CI / local)

```bash
npm run test:post-release
npm run test:rc1
bash scripts/secret-hygiene-scan.sh
```

## Monitoring (first 24 hours)

- [ ] `checkLiveness()` → ok
- [ ] `checkReadiness()` → ok, `payment_provider_safe`
- [ ] `collectMonitoringSnapshot()` — no critical alerts
- [ ] `evaluateAlertRules()` — review High/Medium
- [ ] DLQ count stable (`getDeadLetterQueue().list()`)
- [ ] Provider fallback rate acceptable
- [ ] No `ops.secret_validation_failures`

## Core journey (staging/production smoke)

- [ ] Sign-in / sign-out
- [ ] Text chat turn
- [ ] Voice session initializes
- [ ] Trip plan creation
- [ ] Mock booking → payment → ticket → notification
- [ ] My Trips access
- [ ] No secrets in client bundle

## Incident readiness

- [ ] On-call knows `MONITORING_RUNBOOK.md`
- [ ] `ALERTING_MATRIX.md` severity mapping understood
- [ ] `INCIDENT_TEMPLATE.md` available
- [ ] `CUSTOMER_SUPPORT_RUNBOOK.md` shared with support

## Sign-off

- Engineer: __________ date: __________
- Commit / tag: __________
- `evaluatePatchRelease` action: __________
