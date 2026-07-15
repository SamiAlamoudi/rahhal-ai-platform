# Rollback Plan — v1.0.0-rc1

## Scope

This plan covers rolling back a **staging** (or premature production) deploy of Rahhal `v1.0.0-rc1` without data-destructive surprise.

## Triggers

- Blocker/Critical regression after deploy
- Auth or database outage impacting core journey
- Accidental enablement of live payments or live providers
- Edge Function failure that breaks readiness

## Immediate actions (RTO target: minutes)

1. **Redeploy previous known-good SPA artifact** (last `main` SHA before RC1 deploy).
2. Keep `VITE_PAYMENT_PROVIDER=mock`.
3. Force `VITE_LIVE_PROVIDERS_ENABLED=false` if provider-related.
4. Roll back Edge Functions to the previous tagged deploy (`supabase functions deploy` of last good version), especially `ops-health` and payment/provider proxies.
5. Confirm probes:
   - `/health.json` → ok
   - `ops-health?probe=ready` → ok + payment mock safe
6. Post SHA before/after in the incident channel (see `docs/INCIDENT_RESPONSE.md`).

## Data / migrations

1. Prefer forward-fix for schema issues when safe.
2. If a migration must be reversed: restore from Supabase PITR/backup to a **scrubbed** staging clone first; never copy prod PII into shared staging casually.
3. Re-run readiness + auth smoke + mock checkout path after restore.

## Feature-flag kill switches

| Switch | Safe value |
|--------|------------|
| `VITE_PAYMENT_PROVIDER` | `mock` |
| `VITE_LIVE_PROVIDERS_ENABLED` | `false` |
| Per-provider live flags | off |
| Mock fallback | on |

## Validation after rollback

```bash
npm run test:smoke   # or staging manual checklist
```

Confirm:

- [ ] App loads
- [ ] Auth works
- [ ] Mock payment only
- [ ] Live providers off
- [ ] Readiness green

## Ownership

- Deploy / SPA rollback: engineering on-call
- Edge Function rollback: backend/platform owner
- Communication: ops owner per `docs/INCIDENT_RESPONSE.md`
