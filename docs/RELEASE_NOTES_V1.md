# Release Notes — Rahhal Production V1

**Release:** `1.0.0`  
**Release candidate:** `1.0.0-rc`  
**Package version:** `1.1.0-rc.1`  
**Codename:** Production Deployment & Launch Automation (Sprint 68)

## Highlights

- Deployment profiles: development / staging / beta / production
- CI/CD automation: lint, typecheck, test, release build, smoke, rollback trigger
- Secrets validation for Amadeus, Booking.com, Duffel, Stripe, HyperPay, Apple Pay, notifications
- Production subsystem health APIs + metrics + alert evaluation
- Rollback playbooks (deployment, configuration, provider, feature, safe mode, startup recovery)
- Release automation artifacts: notes, deployment/env reports, feature matrix, go-live checklist
- Composes Sprint 65 hardening + Sprint 66 E2E validation (no business-logic changes)

## Safe defaults (unchanged)

- Mock payments
- Live providers OFF
- No architecture rewrites; no product feature removals

## Upgrade / migration

None. Additive `src/lib/ops/deployment/` module only. Existing Phase X/AA and Sprint 65/66 APIs preserved.

## Deployment notes

See `docs/SPRINT68_PRODUCTION_DEPLOYMENT.md`, `docs/LAUNCH_AUTOMATION_V1.md`, and `docs/PRODUCTION_CHECKLIST_V1.md`.

## GitHub Release body (copy)

```
## Rahhal Production V1 (Sprint 68)

Production deployment & launch automation — profiles, CI/CD gates, secrets validation,
health/metrics/alerts, rollback, release artifacts. No product feature changes.

### Validation
- lint / typecheck / test:run / build
- npm run deploy:verify
- npm run production:verify

### Defaults
- Payments: mock
- Live providers: off

### Docs
- docs/SPRINT68_PRODUCTION_DEPLOYMENT.md
- docs/LAUNCH_AUTOMATION_V1.md
- docs/RELEASE_NOTES_V1.md
```
