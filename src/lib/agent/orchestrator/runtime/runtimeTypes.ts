/**
 * Phase 2 Stage 4 — Runtime Coordinator types.
 * Coordination contracts only. No intelligence algorithms.
 */

export type RuntimeLocale = 'ar' | 'en'

/** Coordinator-managed consultant stages (mission set). */
export type RuntimeStageId =
  | 'traveler_intelligence'
  | 'destination_intelligence'
  | 'travel_strategy'
  | 'recommendation_intelligence'
  | 'reflection'
  | 'planning_graph'
  | 'unified_consultant_response'

export type RuntimeStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'skipped'
  | 'cached'
  | 'failed'
  | 'timeout'
  | 'cancelled'

export interface RuntimeKnownSlots {
  destination?: string | null
  origin?: string | null
  budgetAmount?: number | null
  budgetCurrency?: string | null
  durationDays?: number | null
  adults?: number | null
  children?: number | null
  monthHint?: number | null
  interests?: string[]
  tripPurpose?: string | null
  compareWith?: string | null
}

export interface RuntimeCoordinatorInput {
  locale?: RuntimeLocale
  userText: string
  conversationId?: string
  sessionId?: string
  known?: RuntimeKnownSlots
  tripPlan?: unknown
  requirements?: unknown
  toolResults?: unknown[]
  /** Subset of stages to run; default = full mission set in dependency order. */
  stages?: RuntimeStageId[]
  signal?: AbortSignal
  /** Per-stage timeout (ms). Default 5000. */
  stageTimeoutMs?: number
  /** Max retries after failure (not timeouts). Default 0. */
  maxRetries?: number
  /** Force-enable regardless of registry. */
  enabled?: boolean
  now?: Date
  /**
   * Test-only fault injection at the coordinator boundary (does not modify engines).
   * `throw` → stage error; `timeout` → simulate timeout before work.
   */
  faultInject?: Partial<Record<RuntimeStageId, 'throw' | 'timeout'>>
}

export interface RuntimeStageRecord {
  stageId: RuntimeStageId
  status: RuntimeStageStatus
  durationMs: number
  attempts: number
  cacheHit: boolean
  errorCode: string | null
  /** Opaque stage output (read-only bag). */
  output: unknown
}

export interface RuntimeCoordinatorResult {
  enabled: true
  locale: RuntimeLocale
  sessionId: string
  executionOrder: RuntimeStageId[]
  stages: RuntimeStageRecord[]
  /** Shared context bags keyed by stage (enrich-only). */
  sharedContext: Record<string, unknown>
  cancelled: boolean
  success: boolean
  telemetry: RuntimeTelemetrySnapshot
  /** Optional unified response package when that stage ran. */
  consultantResponse: unknown | null
}

export interface RuntimeTelemetrySnapshot {
  executionOrder: RuntimeStageId[]
  stageDurations: Record<string, number>
  cacheHits: number
  cacheMisses: number
  retries: number
  timeouts: number
  failures: number
  totalDurationMs: number
}

export const DEFAULT_STAGE_TIMEOUT_MS = 5000
export const DEFAULT_MAX_RETRIES = 0

export const RUNTIME_STAGE_ORDER: readonly RuntimeStageId[] = [
  'reflection',
  'traveler_intelligence',
  'planning_graph',
  'destination_intelligence',
  'recommendation_intelligence',
  'travel_strategy',
  'unified_consultant_response',
] as const

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}
