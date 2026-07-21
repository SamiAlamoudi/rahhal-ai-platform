# Operational Handbook (V1)

## Daily

1. Check readiness/health probes
2. Review `ops.errors` / `provider.failures` counters
3. Confirm payment remains `mock`

## Weekly

1. Run `generateProductionReadinessReport()`
2. Review feature flag audit (`riskyEnabled`)
3. Rotate any Edge secrets if live providers used in staging

## Release

1. `npm run ci`
2. Staging checklist (`docs/STAGING_CHECKLIST.md`)
3. Production checklist (`docs/PRODUCTION_CHECKLIST_V1.md`)
4. Deploy; verify probes
5. Keep live providers OFF unless explicitly approved

## Contacts / playbooks

- Incidents: `docs/INCIDENT_RESPONSE.md`
- Rollback: `ROLLBACK_PLAN.md`
- Hotfix: `HOTFIX_PROCESS.md`
- Support: `CUSTOMER_SUPPORT_RUNBOOK.md`
