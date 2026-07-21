# Sprint 65 — Production Hardening & Go Live

Rahhal Production V1 readiness. **No new product features.** Extends Phase X/AA `src/lib/ops/` with Sprint 65 production gates.

## Module

`src/lib/ops/production/`

| Capability | Entry |
|------------|--------|
| Security audit | `runSecurityAudit()` |
| Feature flag audit | `auditFeatureFlags()` |
| Config audit | `auditProductionConfig()` |
| Data integrity | `validateDataIntegrity()` |
| Recovery plans | `planRecovery()` |
| Domain timers | `timeDomain` / `recordDomainTiming` |
| Provider log bridge | `installProviderLogBridge()` |
| Dependency checks | `runDependencyChecks()` |
| Go-live report | `generateProductionReadinessReport()` |
| Install | `installProductionHardening()` (wired from `runStartup`) |

## Safe Production V1 defaults

- `VITE_PAYMENT_PROVIDER=mock`
- `VITE_LIVE_PROVIDERS_ENABLED=false`
- Live provider feature flags OFF
- `payments.live` / `providers.live_master` OFF
- Production CSP strict (`script-src 'self'`)

## Validation

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Docs delivered this sprint

See `docs/*_V1.md`, `docs/RELEASE_NOTES_V1.md`, `docs/PRODUCTION_CHECKLIST_V1.md`, `docs/KNOWN_LIMITATIONS_V1.md`.
