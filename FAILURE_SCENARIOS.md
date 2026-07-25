# Failure Scenarios — Sprint 16

## Injected faults

| Kind | Effect |
|------|--------|
| `provider_timeout` | Fail attempt + latency; triggers retry |
| `provider_unavailable` | Hard fail attempt; retry / fallback |
| `network_latency` | Extra latency; success path |
| `slow_response` | Extra latency; success path |
| `memory_pressure` | Degraded path; continuity preserved |
| `cpu_spike` | Extra latency; continuity preserved |
| `partial_failure` | Fail with partial flag → degraded/fallback |

## Example configuration

```ts
createLoadRunner().run({
  scenarioId: 'mixed_workloads',
  enabled: true,
  failures: [
    { kind: 'provider_timeout', probability: 0.3, latencyMs: 40 },
    { kind: 'partial_failure', probability: 0.1 },
  ],
})
```

## Expected outcomes

- Retries recover transient timeouts when a later attempt succeeds  
- Persistent faults open the simulated circuit and engage fallback  
- Conversation continuity remains high (sessions rarely `failed`)  
