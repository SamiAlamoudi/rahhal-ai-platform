# Rollback Plan — v1.0.0-rc1

## Trigger conditions

Roll back the staging (or candidate) deploy if any of the following occur:

- Readiness/health probes fail after deploy
- Auth/sign-in broken for all users
- Mock payment path fails end-to-end
- Unexpected live payment or live provider traffic
- Secret exposure in client bundle or logs
- Data integrity / RLS ownership failures

## Immediate actions (first 15 minutes)

1. Announce incident channel + capture deploy SHA (`git rev-parse HEAD`).
2. Stop promotion: do not tag `v1.0.0` or ship to production.
3. Redeploy previous known-good SPA artifact / commit from `main` before RC1.
4. Confirm environment:
   - `VITE_PAYMENT_PROVIDER=mock`
   - `VITE_LIVE_PROVIDERS_ENABLED=false` (and per-provider flags off)
5. Redeploy prior Edge Function revision if probes implicate Edge code.
6. Re-run readiness: `ops-health?probe=ready` and `/health.json`.
7. Run smoke: `npm run test:smoke` against the rolled-back config; complete manual `STAGING_SMOKE_TEST.md` checks 1–10.

## Data / migrations

- Prefer forward-fix for additive migrations.
- If a migration is implicated, restore staging DB from the latest staging backup / PITR (Supabase), then re-apply only known-good migrations.
- Never restore production data into shared staging without PII scrubbing.

## Verification after rollback

- [ ] Liveness OK
- [ ] Readiness OK with mock payment
- [ ] Auth smoke OK
- [ ] Mock flight/hotel search OK
- [ ] Mock booking → payment → ticketing path OK
- [ ] No client secrets in bundle
- [ ] Incident note with before/after SHA posted

## Owners

- Deploy rollback: engineering on-call
- DB restore: platform / Supabase admin
- Comms: product/ops owner
