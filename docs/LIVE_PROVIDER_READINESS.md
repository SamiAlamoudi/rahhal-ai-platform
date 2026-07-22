# Live Provider Integration Readiness — Sprint 90

**Sprint:** 90 — Live Provider Integration Readiness  
**Date:** 2026-07-22  
**Type:** Infrastructure only (no AI / conversation / planner / decision / package / learning changes)  
**Module:** `src/core/providers/`  
**Version:** `1.0.0-live-provider-readiness`

---

## Executive verdict

# READY (infrastructure)

Rahhal now has a **core provider readiness layer** that standardizes:

- Mock / Sandbox / Live modes  
- Required provider surface (`health`, `searchFlights`, `searchHotels`, `searchPackages`, `capabilities`, `limits`)  
- Secrets validation (presence only — no secret leakage)  
- Circuit breaker (CLOSED / OPEN / HALF_OPEN) with automatic recovery  
- Retry policy (network, 429, 5xx, DNS, timeout)  
- Priority + automatic failover (primary → secondary → fallback)  
- Metrics (availability, latency, success/failure, recovery)

This layer **coexists** with Sprint 71 `src/lib/agent/providerRuntime` and Sprint 56 `liveProviders`. It does **not** replace them in this sprint and does **not** change traveler-facing AI behavior.

---

## Modes

| Mode | Purpose | Default |
| --- | --- | --- |
| **Mock** | Deterministic local offers; CI / Alpha | **Yes** |
| **Sandbox** | Reachability + contract drills against sandbox hosts | Opt-in |
| **Live** | Real supplier traffic (requires secrets + flags) | Opt-in (ops) |

Resolve with `resolveOperatingMode({ forceMock, sandboxEnabled, liveEnabled })`.

---

## Required provider surface

Every registered `TravelProvider` must implement:

| Method | Role |
| --- | --- |
| `health()` | Liveness / latency probe |
| `searchFlights()` | Flight inventory |
| `searchHotels()` | Hotel inventory |
| `searchPackages()` | Package inventory |
| `capabilities()` | Feature map |
| `limits()` | RPM, concurrency, timeout, retries |

`assertProviderSurface()` rejects incomplete adapters at registration time.

---

## Validation coverage

| Check | Mechanism |
| --- | --- |
| API key exists | `apiKeyExists` / `validateProviderSecrets` |
| Secrets loaded | Required key presence report |
| Sandbox reachable | `checkSandboxReachable` → `health()` |
| Timeout handling | Retry policy AbortController timeout |
| Retry policy | Network / 429 / 5xx / DNS / timeout |
| Rate limiting | Classified as `RATE_LIMITED` (retryable) |
| Provider unavailable | Failover to next tier |
| Partial results | `ProviderSearchResult.partial` |
| Empty results | `ProviderSearchResult.empty` (ok without throw) |
| Slow provider | Latency recorded in metrics; timeout aborts |

---

## Circuit breaker

States: **CLOSED** → **OPEN** → **HALF_OPEN** → **CLOSED**

- Opens after `failureThreshold` failures  
- After `openMs`, probes HALF_OPEN  
- Required successes close the circuit and increment `recoveryCount`  

---

## Retry policy

Retries (with exponential backoff) when classified as:

- Network failure  
- 429 rate limit  
- 5xx server error  
- DNS failure  
- Timeout  

Does **not** retry unauthorized / forbidden / non-retryable codes. Honors circuit OPEN.

---

## Priority & failover

Tiers: **primary** → **secondary** → **fallback**

`executeWithFailover` / registry `searchFlightsWithFailover` / `searchHotelsWithFailover` attempt the next tier automatically.

---

## Metrics

Per provider:

- Availability / success rate / failure rate  
- Average + total latency  
- Timeouts  
- Recovery count  
- Last error / last success / last failure timestamps  

---

## Evidence

- Tests: `src/lib/__tests__/providerReadiness.sprint90.test.ts` (17)  
- Verify: `npm run providers-readiness:verify`  
- Architecture: `docs/PROVIDER_ARCHITECTURE.md`  
- Checklist: `docs/PROVIDER_CHECKLIST.md`  

---

## Explicit non-goals (this sprint)

- No AI engine changes  
- No conversation / planner / learning / package / decision changes  
- No live credential commits  
- No forced cutover of Sprint 71 runtime consumers  

Next sprint may optionally bridge Runtime → core contracts without changing AI.
