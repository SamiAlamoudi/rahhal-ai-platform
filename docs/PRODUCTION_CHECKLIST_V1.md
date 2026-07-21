# Production Checklist (V1)

- [ ] `VITE_PAYMENT_PROVIDER=mock`
- [ ] `VITE_LIVE_PROVIDERS_ENABLED=false`
- [ ] Supabase URL + anon key configured
- [ ] No provider secrets in `VITE_*`
- [ ] `npm run lint` / `typecheck` / `test:run` / `build` green
- [ ] `generateProductionReadinessReport().productionReady === true`
- [ ] Security audit: no open `risk` findings
- [ ] Feature flag audit: no critical must-be-off flags enabled
- [ ] Health / readiness probes OK
- [ ] CSP production profile unchanged (`script-src 'self'`)
- [ ] Runbooks reviewed
- [ ] Known limitations acknowledged

Library helper: `buildProductionChecklist` inside readiness report.
