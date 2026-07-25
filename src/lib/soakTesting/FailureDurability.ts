/**
 * Sprint 19 — repeated failure injection durability.
 */

import { createFailureInjector } from '../loadTesting/FailureInjector'
import { createResilienceSimulator } from '../loadTesting/ResilienceSimulator'

export function runFailureDurability(rounds = 100): {
  ok: boolean
  rounds: number
  continuityRate: number
} {
  const sim = createResilienceSimulator({
    maxRetries: 2,
    openAfterFailures: 3,
    halfOpenAfterMs: 5,
    baseLatencyMs: 1,
  })
  const injector = createFailureInjector([
    { kind: 'provider_unavailable', probability: 0.5 },
    { kind: 'provider_timeout', probability: 0.3, latencyMs: 10 },
    { kind: 'partial_failure', probability: 0.2 },
  ])

  let continued = 0
  for (let i = 0; i < rounds; i++) {
    // Reset circuit periodically to simulate half-open recovery windows
    if (i % 10 === 0) sim.reset()
    const step = sim.executeStep(`durability.${i}`, injector)
    if (step.outcome !== 'failed') continued += 1
  }

  const continuityRate = continued / rounds
  return {
    ok: continuityRate >= 0.95,
    rounds,
    continuityRate,
  }
}
