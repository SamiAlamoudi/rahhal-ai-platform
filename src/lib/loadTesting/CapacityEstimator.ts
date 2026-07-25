/**
 * Sprint 16 — CapacityEstimator (server sizing / scaling thresholds).
 */

import type { AggregatedLatency, CapacityEstimate, StressProfile } from './types'

export class CapacityEstimator {
  estimate(input: {
    profile: StressProfile
    latency: AggregatedLatency
    errorRate: number
    throughputSessionsPerSec: number
  }): CapacityEstimate {
    const users = input.profile.concurrentUsers
    const p95 = input.latency.p95Ms
    const bottlenecks: string[] = []

    if (p95 > 200) bottlenecks.push('provider_latency')
    if (input.profile.providerCallsPerTurn >= 6) bottlenecks.push('provider_fanout')
    if (input.profile.bookingOrchestrationWeight >= 0.5) bottlenecks.push('booking_orchestration')
    if (input.profile.longRunning) bottlenecks.push('long_conversation_state')
    if (input.errorRate > 0.05) bottlenecks.push('error_budget')
    if (users >= 500) bottlenecks.push('connection_concurrency')
    if (bottlenecks.length === 0) bottlenecks.push('none_observed')

    let recommendedServerSize: CapacityEstimate['recommendedServerSize'] = 'small'
    if (users >= 200 || p95 > 100) recommendedServerSize = 'medium'
    if (users >= 500 || p95 > 250) recommendedServerSize = 'large'
    if (users >= 1000 || input.profile.providerCallsPerTurn >= 8) recommendedServerSize = 'xlarge'

    // Capacity heuristic: scale from observed p95 + error budget headroom
    const headroom = input.errorRate < 0.02 && p95 < 150 ? 1.5 : 1.1
    const concurrentUserCapacity = Math.max(users, Math.floor(users * headroom))
    const scalingThresholdUsers = Math.floor(concurrentUserCapacity * 0.7)

    return {
      recommendedServerSize,
      concurrentUserCapacity,
      scalingThresholdUsers,
      expectedBottlenecks: bottlenecks,
      notes:
        `Estimated from scenario ${input.profile.id} at ${users} users; `
        + `throughput≈${input.throughputSessionsPerSec.toFixed(2)} sessions/s. `
        + 'Additive simulation — validate against staging load before production resize.',
    }
  }
}

export function createCapacityEstimator(): CapacityEstimator {
  return new CapacityEstimator()
}
