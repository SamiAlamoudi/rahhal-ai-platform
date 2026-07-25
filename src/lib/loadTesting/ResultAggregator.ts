/**
 * Sprint 16 — ResultAggregator (latency / rates / resilience stats).
 */

import type {
  AggregatedLatency,
  LoadRunReport,
  ResilienceValidation,
  SessionResult,
  StressProfile,
} from './types'
import { CapacityEstimator } from './CapacityEstimator'
import { LOAD_TESTING_PLATFORM_VERSION } from './types'

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

export class ResultAggregator {
  aggregateLatency(durations: number[]): AggregatedLatency {
    const sorted = [...durations].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((a, b) => a + b, 0)
    return {
      count,
      averageMs: count ? sum / count : 0,
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      minMs: count ? sorted[0]! : 0,
      maxMs: count ? sorted[count - 1]! : 0,
    }
  }

  buildReport(input: {
    profile: StressProfile
    sessions: SessionResult[]
    startedAt: string
    endedAt: string
    peakMemoryMb?: number
    cpuUtilizationEstimate?: number
  }): LoadRunReport {
    const stepDurations = input.sessions.flatMap((s) => s.steps.map((st) => st.durationMs))
    const latency = this.aggregateLatency(stepDurations)
    const n = Math.max(1, input.sessions.length)
    const wallMs = Math.max(
      1,
      Date.parse(input.endedAt) - Date.parse(input.startedAt),
    )
    const errored = input.sessions.filter((s) => s.outcome === 'failed').length
    const degraded = input.sessions.filter((s) =>
      s.outcome === 'degraded' || s.outcome === 'fallback' || s.outcome === 'circuit_open',
    ).length
    const fallback = input.sessions.filter((s) =>
      s.steps.some((st) => st.fallbackUsed),
    ).length
    const retryRecovered = input.sessions.filter((s) =>
      s.outcome === 'retry_recovered' || s.steps.some((st) => st.outcome === 'retry_recovered'),
    ).length
    const circuit = input.sessions.filter((s) =>
      s.steps.some((st) => st.circuitOpen || st.outcome === 'circuit_open'),
    ).length
    const continuity = input.sessions.filter((s) => s.conversationContinued).length
    const recoveries = input.sessions
      .map((s) => s.recoveryDurationMs)
      .filter((v): v is number => v != null)
    const averageRecoveryMs = recoveries.length
      ? recoveries.reduce((a, b) => a + b, 0) / recoveries.length
      : 0

    const capacity = new CapacityEstimator().estimate({
      profile: input.profile,
      latency,
      errorRate: errored / n,
      throughputSessionsPerSec: (input.sessions.length / wallMs) * 1000,
    })

    return {
      version: LOAD_TESTING_PLATFORM_VERSION,
      scenarioId: input.profile.id,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      concurrentUsers: input.profile.concurrentUsers,
      sessions: input.sessions,
      latency,
      throughputSessionsPerSec: (input.sessions.length / wallMs) * 1000,
      errorRate: errored / n,
      degradationRate: degraded / n,
      fallbackRate: fallback / n,
      retryRecoveryRate: retryRecovered / n,
      circuitOpenRate: circuit / n,
      conversationContinuityRate: continuity / n,
      averageRecoveryMs,
      peakMemoryMb: input.peakMemoryMb ?? estimateMemoryMb(),
      cpuUtilizationEstimate: input.cpuUtilizationEstimate ?? estimateCpu(input.profile),
      capacity,
    }
  }

  validateResilience(report: LoadRunReport): ResilienceValidation {
    return {
      gracefulDegradation: report.degradationRate > 0 || report.fallbackRate > 0 || report.errorRate < 0.25,
      automaticRetry: report.retryRecoveryRate > 0 || report.degradationRate > 0 || report.errorRate === 0,
      circuitBreakerBehavior: report.circuitOpenRate > 0 || report.fallbackRate > 0,
      fallbackExecution: report.fallbackRate > 0 || report.circuitOpenRate > 0,
      recoveryTimeOk: report.averageRecoveryMs < 5_000,
      conversationContinuity: report.conversationContinuityRate >= 0.95,
    }
  }
}

function estimateMemoryMb(): number {
  try {
    const perf = (globalThis as {
      performance?: { memory?: { usedJSHeapSize?: number } }
    }).performance
    const used = perf?.memory?.usedJSHeapSize
    if (used) return used / (1024 * 1024)
  } catch {
    /* ignore */
  }
  try {
    const mem = (globalThis as {
      process?: { memoryUsage?: () => { heapUsed: number } }
    }).process?.memoryUsage?.()
    if (mem) return mem.heapUsed / (1024 * 1024)
  } catch {
    /* ignore */
  }
  return 0
}

function estimateCpu(profile: StressProfile): number {
  // Coarse synthetic estimate for reports (0–1)
  const load = profile.concurrentUsers * profile.providerCallsPerTurn * profile.turnsPerSession
  return Math.min(0.95, load / 50_000)
}

export function createResultAggregator(): ResultAggregator {
  return new ResultAggregator()
}
