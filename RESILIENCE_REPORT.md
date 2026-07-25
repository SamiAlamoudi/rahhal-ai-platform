# Resilience Report — Sprint 16

## Validated behaviors

| Behavior | Mechanism | Result |
|----------|-----------|--------|
| Graceful degradation | Partial failure / pressure → `degraded` outcome | PASS |
| Automatic retry | Up to N retries on provider timeout/unavailable | PASS |
| Circuit breaker | Opens after consecutive failures; half-open after window | PASS |
| Fallback execution | Failed steps return fallback; conversation continues | PASS |
| Recovery time | `averageRecoveryMs` tracked; budget &lt; 5s in CI | PASS |
| Conversation continuity | Sessions do not hard-fail under injected faults | PASS (≥95%) |

## Design notes

- `ResilienceSimulator` is **standalone** for load tests — it does **not** modify Provider Runtime circuit breakers or Observability Platform.
- Continuity means travelers keep a usable conversation path under provider faults (fallback / degraded), matching production readiness goals.

## Non-goals

- No external chaos tooling (Gremlin, etc.)
- No live Amadeus/Duffel soak in this sprint
