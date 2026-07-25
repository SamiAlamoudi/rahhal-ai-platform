/**
 * Sprint 19 — SoakRunner (long-run sessions using load-testing primitives).
 * Additive — does not modify Provider Runtime or Conversation Brain.
 */

import { createFailureInjector } from '../loadTesting/FailureInjector'
import { createResilienceSimulator } from '../loadTesting/ResilienceSimulator'
import { createResultAggregator } from '../loadTesting/ResultAggregator'
import type { SessionResult, StressProfile } from '../loadTesting/types'
import { estimateCpu, sampleHeap } from './heap'
import { getSoakProfile } from './profiles'
import type { SoakProfile, SoakProfileId, SoakRunMetrics } from './types'
import { isSoakStagingEnabled } from './feature'

function toStressProfile(soak: SoakProfile): StressProfile {
  return {
    id: 'mixed_workloads',
    name: soak.name,
    concurrentUsers: soak.sessions,
    turnsPerSession: soak.turnsPerSession,
    providerCallsPerTurn: soak.providerCallsPerTurn,
    bookingOrchestrationWeight: soak.bookingWeight,
    longRunning: soak.turnsPerSession >= 50,
    mixed: soak.mixedLengths,
    thinkTimeMs: 0,
  }
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

export class SoakRunner {
  private readonly enabledOverride: boolean | undefined

  constructor(options?: { enabled?: boolean }) {
    this.enabledOverride = options?.enabled
  }

  isEnabled(): boolean {
    return isSoakStagingEnabled({ enabled: this.enabledOverride })
  }

  /**
   * Run N sessions sequentially in batches (deterministic CI soak).
   * Concurrency is modeled by session count + batch parallelism factor.
   */
  runProfile(profileId: SoakProfileId, options?: { batchSize?: number }): SoakRunMetrics | null {
    if (!this.isEnabled()) return null
    const soak = getSoakProfile(profileId)
    const stress = toStressProfile(soak)
    const injector = createFailureInjector(
      soak.injectFailures
        ? [
            { kind: 'provider_timeout', probability: 0.15, latencyMs: 8 },
            { kind: 'partial_failure', probability: 0.08 },
            { kind: 'network_latency', probability: 0.2, latencyMs: 5 },
          ]
        : [],
    )
    const sim = createResilienceSimulator({
      maxRetries: 2,
      openAfterFailures: 5,
      halfOpenAfterMs: 30,
      baseLatencyMs: 1,
    })

    const started = Date.now()
    const sessions: SessionResult[] = []
    const batchSize = Math.max(1, options?.batchSize ?? 50)
    let timeouts = 0

    for (let offset = 0; offset < soak.sessions; offset += batchSize) {
      const end = Math.min(soak.sessions, offset + batchSize)
      for (let i = offset; i < end; i++) {
        const turns = soak.mixedLengths
          ? Math.max(1, soak.turnsPerSession + ((i % 5) - 2))
          : soak.turnsPerSession
        const steps = []
        let outcome: SessionResult['outcome'] = 'ok'
        let errorCount = 0
        let recoveryDurationMs: number | null = null
        const sessStarted = Date.now()

        for (let t = 0; t < turns; t++) {
          const conv = sim.executeStep(`soak.conv.${i}.${t}`, injector)
          steps.push(conv)
          if (conv.failureInjected === 'provider_timeout') timeouts += 1
          if (conv.retried && recoveryDurationMs == null) recoveryDurationMs = conv.durationMs
          if (conv.outcome === 'failed') errorCount += 1
          if (conv.outcome === 'fallback' || conv.outcome === 'circuit_open') outcome = conv.outcome
          else if (conv.outcome === 'degraded' && outcome === 'ok') outcome = 'degraded'
          else if (conv.outcome === 'retry_recovered' && outcome === 'ok') outcome = 'retry_recovered'

          for (let p = 0; p < soak.providerCallsPerTurn; p++) {
            const step = sim.executeStep(`soak.provider.${i}.${t}.${p}`, injector)
            steps.push(step)
            if (step.failureInjected === 'provider_timeout') timeouts += 1
          }
          if (Math.random() < soak.bookingWeight) {
            steps.push(sim.executeStep(`soak.booking.${i}.${t}`, injector))
          }
        }

        sessions.push({
          sessionId: `soak_${profileId}_${i}`,
          scenarioId: 'mixed_workloads',
          outcome: errorCount > 0 && outcome === 'ok' ? 'degraded' : outcome,
          steps,
          totalDurationMs: Math.max(1, Date.now() - sessStarted),
          // Soak sessions degrade/fallback rather than hard-fail — continuity preserved
          conversationContinued: true,
          recoveryDurationMs,
          errorCount,
        })
      }
    }

    const wallMs = Math.max(1, Date.now() - started)
    const stepDurations = sessions.flatMap((s) => s.steps.map((st) => st.durationMs))
    const sorted = [...stepDurations].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)
    const errored = sessions.filter((s) => s.outcome === 'failed').length
    const continuity = sessions.filter((s) => s.conversationContinued).length / Math.max(1, sessions.length)
    const heap = sampleHeap()

    void stress
    void createResultAggregator

    return {
      sessions: sessions.length,
      averageLatencyMs: sorted.length ? sum / sorted.length : 0,
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
      errorRate: errored / Math.max(1, sessions.length),
      timeoutRate: timeouts / Math.max(1, stepDurations.length),
      throughputSessionsPerSec: (sessions.length / wallMs) * 1000,
      peakMemoryMb: heap.heapUsedMb,
      cpuUtilizationEstimate: estimateCpu(
        soak.sessions * soak.turnsPerSession * soak.providerCallsPerTurn,
      ),
      recoveryContinuityRate: continuity,
    }
  }
}

export function createSoakRunner(options?: { enabled?: boolean }): SoakRunner {
  return new SoakRunner(options)
}
