# Provider Integration Checklist — Sprint 90

Use this checklist before enabling any live supplier against Rahhal.

---

## A. Mode & flags

- [ ] Confirm default remains **mock** for CI / Alpha  
- [ ] Sandbox mode validated with `checkSandboxReachable`  
- [ ] Live mode requires explicit ops approval  
- [ ] `ai.live_providers` / `VITE_LIVE_PROVIDERS_ENABLED` understood (Sprint 56/71 — unchanged)  

---

## B. Secrets

- [ ] Required API keys present in server env (not `VITE_*` OAuth secrets in client)  
- [ ] `validateProviderSecrets` report `ok: true`  
- [ ] Missing keys listed in ops ticket (names only)  
- [ ] Rotation procedure documented  

### Key sets (reference)

| Provider | Required |
| --- | --- |
| Amadeus | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` |
| Duffel | `DUFFEL_API_TOKEN` |
| Booking | `BOOKING_API_KEY` |
| Mock | _(none)_ |

---

## C. Provider surface

- [ ] `health()`  
- [ ] `searchFlights()`  
- [ ] `searchHotels()`  
- [ ] `searchPackages()`  
- [ ] `capabilities()`  
- [ ] `limits()`  
- [ ] `assertProviderSurface` returns `[]`  

---

## D. Resilience

- [ ] Circuit breaker opens after threshold failures  
- [ ] Automatic HALF_OPEN recovery verified  
- [ ] Retry covers network / 429 / 5xx / DNS / timeout  
- [ ] Non-retryable 401/403 do not loop  
- [ ] Timeout aborts slow calls  
- [ ] Rate-limit (429) backoff observed  

---

## E. Priority & failover

- [ ] Primary / secondary / fallback registered  
- [ ] Primary failure fails over automatically  
- [ ] Metrics show failure on primary + success on backup  

---

## F. Result shapes

- [ ] Empty results return `ok: true`, `empty: true` (no crash)  
- [ ] Partial results set `partial: true`  
- [ ] Unavailable provider returns retryable error or failover  

---

## G. Metrics

- [ ] Availability  
- [ ] Latency (average)  
- [ ] Success rate  
- [ ] Failure rate  
- [ ] Recovery count  

---

## H. Tests before go-live

```bash
npm run providers-readiness:verify
npm run runtime:verify          # existing Sprint 71
npm run providers:check         # existing CLI checks
npm run test:run
```

- [ ] Sprint 90 readiness suite green  
- [ ] Sprint 71 runtime suite green  
- [ ] No AI / conversation test regressions  

---

## I. Go-live gate

- [ ] Sandbox soak ≥ N successful searches  
- [ ] Circuit breaker dashboards reviewed  
- [ ] Rollback plan: force mock / disable live flags  
- [ ] Incident runbook link attached  

**Sign-off:** _____________  **Date:** _____________
