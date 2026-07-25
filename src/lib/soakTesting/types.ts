/**
 * Sprint 19 — Staging Soak Test (Pre-GA) contracts.
 */

export const SOAK_TESTING_VERSION = '1.0.0-staging-soak-pre-ga'

export type SoakProfileId =
  | 'sessions_500'
  | 'sessions_1000'
  | 'concurrency_50'
  | 'concurrency_100'
  | 'concurrency_250'
  | 'concurrency_500'
  | 'long_turns_50'
  | 'long_turns_100'
  | 'long_turns_150'
  | 'mixed_recovery'

export interface SoakProfile {
  id: SoakProfileId
  name: string
  sessions: number
  turnsPerSession: number
  providerCallsPerTurn: number
  bookingWeight: number
  injectFailures: boolean
  mixedLengths: boolean
}

export interface HeapSample {
  at: string
  heapUsedMb: number
}

export interface MemoryLeakReport {
  samples: HeapSample[]
  peakMb: number
  finalMb: number
  growthMb: number
  leaked: boolean
  cleanupsVerified: string[]
}

export interface SoakRunMetrics {
  sessions: number
  averageLatencyMs: number
  p95Ms: number
  p99Ms: number
  errorRate: number
  timeoutRate: number
  throughputSessionsPerSec: number
  peakMemoryMb: number
  cpuUtilizationEstimate: number
  recoveryContinuityRate: number
}

export interface ConcurrencyResult {
  concurrentUsers: number
  averageResponseMs: number
  p95Ms: number
  contentionScore: number
  parallelBatches: number
}

export interface ReadinessScores {
  architecture: number
  security: number
  performance: number
  reliability: number
  recovery: number
  providers: number
  observability: number
  maintainability: number
  overall: number
}

export interface SoakReport {
  version: string
  generatedAt: string
  profiles: Array<{ id: SoakProfileId; metrics: SoakRunMetrics }>
  concurrency: ConcurrencyResult[]
  memory: MemoryLeakReport
  longConversations: Array<{ turns: number; ok: boolean; durationMs: number }>
  failureDurability: { ok: boolean; rounds: number; continuityRate: number }
  readiness: ReadinessScores
  chatPageBundleKb: number
  decision: 'GO' | 'GO_WITH_CONDITIONS' | 'NO_GO'
  blockers: string[]
  conditions: string[]
}
