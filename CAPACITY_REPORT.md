# Capacity Report — Sprint 16

## Estimator outputs

`CapacityEstimator` produces:

- `recommendedServerSize`: `small` | `medium` | `large` | `xlarge`
- `concurrentUserCapacity`
- `scalingThresholdUsers` (~70% of capacity)
- `expectedBottlenecks`

## Heuristics

| Signal | Influence |
|--------|-----------|
| Concurrent users ≥ 200 / 500 / 1000 | medium → large → xlarge |
| P95 latency | elevates size; flags `provider_latency` |
| Provider fan-out ≥ 6 calls/turn | `provider_fanout` bottleneck |
| Booking weight ≥ 0.5 | `booking_orchestration` |
| Long-running turns | `long_conversation_state` |
| Error rate &gt; 5% | `error_budget` |

## Recommended staging validation

1. Run `concurrent_100` unscaled on staging with mocks  
2. Promote to `concurrent_500` with provider sandbox  
3. Resize when approaching `scalingThresholdUsers`  
4. Watch provider fan-out and booking orchestration first  

Estimates are simulation-backed — confirm with staging soak before production resize.
