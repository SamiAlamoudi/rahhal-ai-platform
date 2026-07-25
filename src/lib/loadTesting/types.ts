/**
 * Sprint 16 — Load Testing & Resilience contracts.
 */

export const LOAD_TESTING_PLATFORM_VERSION = '1.0.0-load-testing-resilience'

export type StressScenarioId =
  | 'concurrent_100'
  | 'concurrent_500'
  | 'concurrent_1000'
  | 'long_running_conversations'
  | 'heavy_provider_activity'
  | 'high_booking_orchestration'
  | 'mixed_workloads'

export type FailureInjectionKind =
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'network_latency'
  | 'slow_response'
  | 'memory_pressure'
  | 'cpu_spike'
  | 'partial_failure'

export type SessionOutcome =
  | 'ok'
  | 'degraded'
  | 'fallback'
  | 'retry_recovered'
  | 'circuit_open'
  | 'failed'

export interface StressProfile {
  id: StressScenarioId
  name: string
  concurrentUsers: number
  turnsPerSession: number
  providerCallsPerTurn: number
  bookingOrchestrationWeight: number
  longRunning: boolean
  mixed: boolean
  /** Simulated think-time between turns (ms). */
  thinkTimeMs: number
}

export interface FailureInjectionConfig {
  kind: FailureInjectionKind
  /** 0–1 probability per provider call */
  probability: number
  /** Extra latency injected (ms) */
  latencyMs?: number
  /** Force circuit breaker open after N failures */
  openCircuitAfter?: number
}

export interface LoadStepResult {
  name: string
  durationMs: number
  outcome: SessionOutcome
  retried: boolean
  fallbackUsed: boolean
  circuitOpen: boolean
  failureInjected: FailureInjectionKind | null
}

export interface SessionResult {
  sessionId: string
  scenarioId: StressScenarioId
  outcome: SessionOutcome
  steps: LoadStepResult[]
  totalDurationMs: number
  conversationContinued: boolean
  recoveryDurationMs: number | null
  errorCount: number
}

export interface AggregatedLatency {
  count: number
  averageMs: number
  p95Ms: number
  p99Ms: number
  minMs: number
  maxMs: number
}

export interface LoadRunReport {
  version: string
  scenarioId: StressScenarioId
  startedAt: string
  endedAt: string
  concurrentUsers: number
  sessions: SessionResult[]
  latency: AggregatedLatency
  throughputSessionsPerSec: number
  errorRate: number
  degradationRate: number
  fallbackRate: number
  retryRecoveryRate: number
  circuitOpenRate: number
  conversationContinuityRate: number
  averageRecoveryMs: number
  peakMemoryMb: number
  cpuUtilizationEstimate: number
  capacity: CapacityEstimate
}

export interface CapacityEstimate {
  recommendedServerSize: 'small' | 'medium' | 'large' | 'xlarge'
  concurrentUserCapacity: number
  scalingThresholdUsers: number
  expectedBottlenecks: string[]
  notes: string
}

export interface ResilienceValidation {
  gracefulDegradation: boolean
  automaticRetry: boolean
  circuitBreakerBehavior: boolean
  fallbackExecution: boolean
  recoveryTimeOk: boolean
  conversationContinuity: boolean
}
