# Release Notes — Rahhal Production V1 (RC)

**Release candidate:** `1.0.0-rc`  
**Package version:** `1.1.0-rc.1`  
**Codename:** Production Hardening & Go Live (Sprint 65)

## Highlights

- Production readiness gates: security audit, feature-flag audit, config audit, dependency checks, data integrity validators
- Provider log bridge into structured logging + ops metrics (correlation IDs)
- Domain latency timers (conversation, trip, booking, document, provider, search, ranking, timeline)
- Recovery playbooks composed from existing retry budgets, circuit fallback, DLQ, booking resume
- Operational documentation suite for V1 deploy/run/recover

## Safe defaults (unchanged)

- Mock payments
- Live providers OFF
- No architecture rewrites; no product feature removals

## Upgrade / migration

None. Additive ops module only. Existing Phase X/AA APIs preserved.

## Deployment notes

See `docs/DEPLOYMENT_GUIDE_V1.md` and `docs/PRODUCTION_CHECKLIST_V1.md`.

## GitHub Release body (copy)

```
## Rahhal Production V1 RC (Sprint 65)

Production hardening only — security audit, observability bridges, recovery plans, go-live checklist, and operational docs.

### Validation
- lint / typecheck / test:run / build

### Defaults
- Payments: mock
- Live providers: off

### Docs
- docs/SPRINT65_PRODUCTION_HARDENING.md
- docs/RELEASE_NOTES_V1.md
- docs/PRODUCTION_CHECKLIST_V1.md
```
