# Production Checklist (V1)

- [ ] `VITE_PAYMENT_PROVIDER=mock`
- [ ] `VITE_LIVE_PROVIDERS_ENABLED=false`
- [ ] Supabase URL + anon key configured
- [ ] No provider secrets in `VITE_*`
- [ ] `npm run lint` / `typecheck` / `test:run` / `build` green
- [ ] `npm run deploy:verify` / `production:verify` green
- [ ] `generateProductionReadinessReport().productionReady === true`
- [ ] `generateDeploymentLaunchReport()` readiness score ≥ 80
- [ ] Security audit: no open `risk` findings
- [ ] Feature flag audit: no critical must-be-off flags enabled
- [ ] Health / readiness / subsystem probes OK
- [ ] Rollback plan armed (`buildRollbackPlan`)
- [ ] CSP production profile unchanged (`script-src 'self'`)
- [ ] Runbooks reviewed
- [ ] Known limitations acknowledged

Library helpers: `buildProductionChecklist`, `buildGoLiveChecklist`, `generateDeploymentLaunchReport`.
