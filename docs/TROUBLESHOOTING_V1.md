# Troubleshooting Guide (V1)

## Build / CI

- Type errors → `npm run typecheck`
- Lint → `npm run lint`
- Provider tests fail with `.env.local` → remove provider `VITE_*` overrides (use mock defaults)

## Runtime

- `createClient` throws → set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- Persistence silent no-op on local Supabase → apply GRANTs (see AGENTS.md)
- CSP blocks scripts in prod → do not weaken production CSP; fix asset origins

## Ops

- Readiness fail → payment not mock or env invalid
- Metrics empty → ensure `installProductionHardening` / startup ran
- Provider logs missing correlation → confirm provider log bridge installed

## Go-live gate

```ts
import { generateProductionReadinessReport } from './lib/ops'
const report = generateProductionReadinessReport({ target: 'production' })
console.log(report.productionReady, report.checklist)
```
