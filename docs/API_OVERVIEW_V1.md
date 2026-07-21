# API Overview (V1)

Rahhal V1 is primarily a SPA. Server surfaces:

| Surface | Purpose |
|---------|---------|
| Supabase Auth REST | Sign-in / session |
| Supabase PostgREST | Persistence under RLS |
| `supabase/functions/ops-health` | live / ready / health |
| `api/health/providers` | Amadeus env health (deploy-specific) |
| Static `/health.json` `/ready.json` | CDN probes |

## Library ops API (in-process)

- Health: `checkLiveness`, `checkReadiness`, `checkHealth`, `runDependencyChecks`
- Metrics: `getOpsMetrics`, `recordDomainTiming`, `recordProviderOutcome`
- Logging: `getLogger`, `withCorrelationId`
- Production: `generateProductionReadinessReport`, `runSecurityAudit`, `auditFeatureFlags`

Agent booking/trip APIs remain under `src/lib/agent/*` — unchanged by Sprint 65.
