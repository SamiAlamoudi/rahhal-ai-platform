# Provider Architecture — Sprint 90

**Scope:** Core readiness infrastructure (`src/core/providers`).  
**Rule:** Additive. Does not redesign Sprint 71 Provider Runtime or AI engines.

---

## Layers (coexistence)

```
┌─────────────────────────────────────────────────────┐
│  AI / Conversation / Decision / Packages (unchanged) │
└──────────────────────────┬──────────────────────────┘
                           │ (existing imports)
┌──────────────────────────▼──────────────────────────┐
│  Sprint 71 Provider Runtime  (src/lib/agent/…)       │
│  Sprint 56 Live Provider SDK                         │
└──────────────────────────┬──────────────────────────┘
                           │ future optional bridge
┌──────────────────────────▼──────────────────────────┐
│  Sprint 90 Core Readiness  (src/core/providers)      │
│  Registry · Health · Circuit · Retry · Secrets ·     │
│  Priority · Metrics · Mock/Sandbox/Live stubs        │
└─────────────────────────────────────────────────────┘
```

Sprint 90 is the **core-facing contract + resilience toolkit**. Existing agent runtime remains the production search path until an explicit cutover sprint.

---

## Module map

| File | Responsibility |
| --- | --- |
| `types.ts` | `TravelProvider` contract + search/health types |
| `ProviderErrors.ts` | Error taxonomy + classification |
| `ProviderCapabilities.ts` | Capabilities / limits helpers |
| `ProviderHealth.ts` | Health probes + summary |
| `ProviderCircuitBreaker.ts` | CLOSED / OPEN / HALF_OPEN |
| `ProviderRetryPolicy.ts` | Backoff retries + timeout |
| `ProviderPriority.ts` | Tier sort + failover executor |
| `ProviderSecretsValidator.ts` | Secret presence checks |
| `ProviderSandbox.ts` | Mode resolution + sandbox reachability |
| `ProviderMetrics.ts` | Availability / latency / recovery |
| `ProviderRegistry.ts` | Registration + failover search |
| `mocks.ts` | Mock / sandbox / live-stub providers |

Barrel: `src/core/providers/index.ts` · re-exported from `src/core/index.ts`.

---

## Provider comparison table (readiness stubs)

| Provider stub | Mode | Flights | Hotels | Packages | Live flag | Use |
| --- | --- | --- | --- | --- | --- | --- |
| `mock` | mock | ✓ | ✓ | ✓ | ✗ | CI / Alpha default |
| `sandbox` | sandbox | ✓ | ✓ | ✓ | ✗ | Reachability drills |
| `live-stub` | live | ✓ | ✓ | ✓ | ✓ | Contract tests without real network |

Real Amadeus / Duffel / Booking adapters remain under `src/lib/agent/liveProviders` / `providerRuntime`.

---

## Failure matrix

| Failure | Classification | Retry? | Circuit | Failover |
| --- | --- | --- | --- | --- |
| Network / fetch failed | `NETWORK_FAILURE` | Yes | Failure++ | Yes |
| Timeout / abort | `TIMEOUT` | Yes | Failure++ | Yes |
| DNS ENOTFOUND | `DNS_FAILURE` | Yes | Failure++ | Yes |
| HTTP 429 | `RATE_LIMITED` | Yes | Failure++ | Yes |
| HTTP 5xx | `SERVER_ERROR` | Yes | Failure++ | Yes |
| HTTP 401/403 | `UNAUTHORIZED`/`FORBIDDEN` | No | Failure++ | Yes (next tier) |
| Circuit open | `CIRCUIT_OPEN` | No | Blocked | Yes (next tier) |
| Secrets missing | `SECRETS_MISSING` | No | n/a | Use mock |
| Empty inventory | (ok, `empty=true`) | n/a | Success path | Optional |
| Partial inventory | (ok, `partial=true`) | n/a | Success path | Optional |

---

## Recovery matrix

| Condition | Recovery action |
| --- | --- |
| Transient 5xx / network | Retry with exponential backoff |
| Circuit OPEN | Wait `openMs` → HALF_OPEN probe |
| HALF_OPEN success | CLOSE + `recoveryCount++` |
| HALF_OPEN failure | Re-OPEN |
| Primary exhausted | Automatic secondary / fallback |
| Sandbox unreachable | Report `reachable=false`; stay on mock |
| Live secrets missing | Block live; keep mock |

---

## Data flow (registry failover search)

```
searchFlightsWithFailover(request)
  → sortProvidersByPriority(primary, secondary, fallback)
  → for each provider:
       if circuit.allow
         try searchFlights
           success → metrics.success + circuit.success + return
           failure → metrics.failure + circuit.failure + next
  → all failed → FailoverResult.ok=false
```

---

## Security notes

- Secrets validator checks **presence only**; never logs secret values.  
- Mock mode needs no secrets.  
- Live mode still gated by existing env/flags in agent Runtime (unchanged this sprint).
