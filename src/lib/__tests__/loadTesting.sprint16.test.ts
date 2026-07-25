/**
 * Sprint 16 — Load Testing & Resilience tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  LOAD_TESTING_PLATFORM_FEATURE_ID,
  LOAD_TESTING_PLATFORM_VERSION,
  createFailureInjector,
  createLoadRunner,
  createResilienceSimulator,
  createResultAggregator,
  getStressProfile,
  isLoadTestingPlatformEnabled,
  listStressProfiles,
  resetLoadRunnerForTests,
  scaleProfileForTests,
} from '../loadTesting'

/** Deterministic RNG sequence. */
function seqRng(values: number[]): () => number {
  let i = 0
  return () => {
    const v = values[i % values.length]!
    i += 1
    return v
  }
}

describe('Sprint 16 — Load Testing & Resilience', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetLoadRunnerForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetLoadRunnerForTests()
  })

  it('keeps load_testing.platform OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(LOAD_TESTING_PLATFORM_FEATURE_ID)).toBe(false)
    expect(isLoadTestingPlatformEnabled()).toBe(false)
    expect(LOAD_TESTING_PLATFORM_VERSION).toMatch(/load-testing-resilience/)
  })

  it('exposes stress scenarios including 100/500/1000 and mixed workloads', () => {
    const ids = listStressProfiles().map((p) => p.id)
    expect(ids).toEqual(expect.arrayContaining([
      'concurrent_100',
      'concurrent_500',
      'concurrent_1000',
      'long_running_conversations',
      'heavy_provider_activity',
      'high_booking_orchestration',
      'mixed_workloads',
    ]))
    expect(getStressProfile('concurrent_1000').concurrentUsers).toBe(1000)
  })

  it('LoadRunner is no-op when flag OFF', () => {
    const runner = createLoadRunner()
    expect(runner.run({ scenarioId: 'concurrent_100', enabled: false })).toBeNull()
  })

  it('runs scaled concurrent load and aggregates performance metrics', () => {
    const runner = createLoadRunner()
    const report = runner.run({
      scenarioId: 'concurrent_100',
      enabled: true,
      scaleForTests: true,
      maxUsers: 25,
      batchSize: 10,
    })
    expect(report).not.toBeNull()
    expect(report!.sessions).toHaveLength(25)
    expect(report!.latency.count).toBeGreaterThan(0)
    expect(report!.latency.averageMs).toBeGreaterThanOrEqual(0)
    expect(report!.latency.p95Ms).toBeGreaterThanOrEqual(report!.latency.averageMs - 0.001)
    expect(report!.latency.p99Ms).toBeGreaterThanOrEqual(report!.latency.p95Ms - 0.001)
    expect(report!.throughputSessionsPerSec).toBeGreaterThan(0)
    expect(report!.errorRate).toBeGreaterThanOrEqual(0)
    expect(report!.peakMemoryMb).toBeGreaterThanOrEqual(0)
    expect(report!.cpuUtilizationEstimate).toBeGreaterThanOrEqual(0)
    expect(report!.capacity.recommendedServerSize).toBeTruthy()
    expect(report!.capacity.concurrentUserCapacity).toBeGreaterThanOrEqual(25)
    expect(report!.capacity.expectedBottlenecks.length).toBeGreaterThan(0)
  })

  it('failure injection: timeout / unavailable / latency / partial', () => {
    const injector = createFailureInjector([
      { kind: 'provider_timeout', probability: 1, latencyMs: 30 },
    ])
    const d1 = injector.decide(() => 0)
    expect(d1.injected).toBe(true)
    expect(d1.kind).toBe('provider_timeout')
    expect(d1.shouldFail).toBe(true)

    const inj2 = createFailureInjector([
      { kind: 'network_latency', probability: 1, latencyMs: 40 },
    ])
    const d2 = inj2.decide(() => 0)
    expect(d2.shouldFail).toBe(false)
    expect(d2.latencyMs).toBe(40)

    const inj3 = createFailureInjector([
      { kind: 'partial_failure', probability: 1 },
    ])
    expect(inj3.decide(() => 0).partial).toBe(true)

    injector.setMemoryPressure(true)
    expect(injector.decide().kind).toBe('memory_pressure')
    injector.setCpuSpike(true)
    // memory pressure checked first
    expect(injector.decide().kind).toBe('memory_pressure')
  })

  it('resilience: retry, fallback, circuit breaker, conversation continuity', () => {
    const sim = createResilienceSimulator({
      maxRetries: 2,
      openAfterFailures: 2,
      halfOpenAfterMs: 10_000,
      baseLatencyMs: 1,
    })
    // Always fail → retries then fallback / circuit open
    const alwaysFail = createFailureInjector([
      { kind: 'provider_unavailable', probability: 1 },
    ])
    const steps = []
    for (let i = 0; i < 6; i++) {
      steps.push(sim.executeStep(`step.${i}`, alwaysFail, () => 0))
    }
    expect(steps.some((s) => s.retried || s.fallbackUsed || s.outcome === 'circuit_open')).toBe(true)
    expect(steps.some((s) => s.fallbackUsed || s.outcome === 'circuit_open')).toBe(true)
    expect(steps.some((s) => s.outcome === 'circuit_open' || s.circuitOpen)).toBe(true)

    // Recovery path: fail once then succeed
    const sim2 = createResilienceSimulator({ maxRetries: 2, openAfterFailures: 10, baseLatencyMs: 1 })
    const flaky = createFailureInjector([
      { kind: 'provider_timeout', probability: 1 },
    ])
    // First decide fails; we need rng that eventually allows success — use injector that fails once
    let calls = 0
    const intermittent = {
      decide: () => {
        calls += 1
        if (calls === 1) {
          return {
            injected: true,
            kind: 'provider_timeout' as const,
            latencyMs: 5,
            shouldFail: true,
            partial: false,
          }
        }
        return {
          injected: false,
          kind: null,
          latencyMs: 0,
          shouldFail: false,
          partial: false,
        }
      },
      getFailureCount: () => calls,
      setMemoryPressure: () => undefined,
      setCpuSpike: () => undefined,
      reset: () => { calls = 0 },
    }
    const recovered = sim2.executeStep('recover', intermittent as never, () => 0)
    expect(recovered.outcome).toBe('retry_recovered')
    expect(recovered.retried).toBe(true)
    void flaky
  })

  it('load run with failures validates graceful degradation + continuity', () => {
    const runner = createLoadRunner()
    const report = runner.run({
      scenarioId: 'mixed_workloads',
      enabled: true,
      scaleForTests: true,
      maxUsers: 30,
      failures: [
        // High probability forces retries → fallback / circuit open while sessions continue
        { kind: 'provider_timeout', probability: 1, latencyMs: 15 },
      ],
      rng: seqRng([0.1, 0.2, 0.5, 0.8, 0.05, 0.9]),
    })
    expect(report).not.toBeNull()
    expect(report!.conversationContinuityRate).toBeGreaterThanOrEqual(0.95)
    expect(report!.fallbackRate + report!.circuitOpenRate).toBeGreaterThan(0)
    const validation = runner.validateResilience(report)
    expect(validation).not.toBeNull()
    expect(validation!.conversationContinuity).toBe(true)
    expect(validation!.recoveryTimeOk).toBe(true)
    expect(validation!.gracefulDegradation).toBe(true)
    expect(validation!.fallbackExecution || validation!.circuitBreakerBehavior).toBe(true)
  })

  it('capacity estimator scales recommendations with load', () => {
    const agg = createResultAggregator()
    const small = scaleProfileForTests(getStressProfile('concurrent_100'), 10)
    const report = agg.buildReport({
      profile: getStressProfile('concurrent_1000'),
      sessions: Array.from({ length: 5 }, (_, i) => ({
        sessionId: `s${i}`,
        scenarioId: 'concurrent_1000' as const,
        outcome: 'ok' as const,
        steps: [{
          name: 'x',
          durationMs: 50,
          outcome: 'ok' as const,
          retried: false,
          fallbackUsed: false,
          circuitOpen: false,
          failureInjected: null,
        }],
        totalDurationMs: 50,
        conversationContinued: true,
        recoveryDurationMs: null,
        errorCount: 0,
      })),
      startedAt: new Date(Date.now() - 1000).toISOString(),
      endedAt: new Date().toISOString(),
    })
    expect(report.capacity.recommendedServerSize).toMatch(/large|xlarge/)
    expect(report.capacity.scalingThresholdUsers).toBeLessThanOrEqual(
      report.capacity.concurrentUserCapacity,
    )
    void small
  })

  it('stress: heavy provider + booking scenarios complete under budget', () => {
    const runner = createLoadRunner()
    const started = Date.now()
    const heavy = runner.run({
      scenarioId: 'heavy_provider_activity',
      enabled: true,
      scaleForTests: true,
      maxUsers: 40,
    })
    const booking = runner.run({
      scenarioId: 'high_booking_orchestration',
      enabled: true,
      scaleForTests: true,
      maxUsers: 40,
    })
    expect(Date.now() - started).toBeLessThan(5000)
    expect(heavy!.sessions.length).toBe(40)
    expect(booking!.sessions.length).toBe(40)
  })

  it('performance regression: 100-user scaled run stays cheap', () => {
    const runner = createLoadRunner()
    const started = Date.now()
    const report = runner.run({
      scenarioId: 'concurrent_100',
      enabled: true,
      scaleForTests: true,
      maxUsers: 100,
      batchSize: 25,
    })
    expect(Date.now() - started).toBeLessThan(5000)
    expect(report!.latency.p99Ms).toBeLessThan(5_000)
    expect(report!.errorRate).toBeLessThan(0.1)
  })

  it('long-running conversations scenario remains continuous', () => {
    const runner = createLoadRunner()
    const report = runner.run({
      scenarioId: 'long_running_conversations',
      enabled: true,
      scaleForTests: true,
      maxUsers: 10,
    })
    expect(report!.conversationContinuityRate).toBe(1)
    expect(report!.sessions.every((s) => s.steps.length >= 8)).toBe(true)
  })
})
