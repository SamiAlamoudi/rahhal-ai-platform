# Sprint 68 — Production Deployment & Launch Automation

Additive ops layer for real production deployment. **No business features. No architecture rewrite.**

## Module

`src/lib/ops/deployment/`

| API | Purpose |
|-----|---------|
| `detectDeployProfile` / `getDeployProfile` | development / staging / beta / production profiles |
| `validateProductionSecrets` | API keys, Amadeus, Booking.com, Duffel, Stripe, HyperPay, Apple Pay, email/WhatsApp/push |
| `buildProductionHealthReport` | Subsystem health (conversation → cache) |
| `collectProductionMetrics` | Latency, error/retry rates, memory |
| `evaluateProductionAlerts` | Provider/payment/booking/auth/critical alerts |
| `buildRollbackPlan` / `triggerRollback` | Deployment, config, provider, feature, safe mode |
| `buildCICDPipelineReport` | lint/typecheck/test/build/smoke/rollback trigger |
| `generateReleaseArtifacts` | Release notes, deployment/env reports, feature matrix, rollback guide, checklist |
| `runDeploymentValidation` | Startup + S65 hardening + S66 E2E gates |
| `generateDeploymentLaunchReport` | Full go-live report + readiness score |
| `runProductionDeploymentPreflight` | Production preflight entrypoint |

## Release

- **Rahhal V1:** `1.0.0` (`RAHHAL_V1_RELEASE_VERSION`)
- **RC:** `1.0.0-rc` (Sprint 65)
- **Package:** `1.1.0-rc.1` (unchanged)

## Scripts

```bash
npm run deploy:verify   # Sprint 68 unit suite
npm run production:verify
```

## CI

`.github/workflows/production-deploy.yml` — quality gates + deployment verification (no host deploy).

## Safe defaults

- Mock payments
- Live providers OFF
- Client must not carry provider secrets in `VITE_*`
