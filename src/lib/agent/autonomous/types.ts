/**
 * Sprint 54 — Autonomous Travel Agent contracts.
 * Structured execution only — Conversation Brain still authors traveler-facing text.
 */

import type { AgentToolName, AgentToolResult, ToolExecutionBatch } from '../tools/types'
import type { TripPlan } from '../types'

/** Explicit autonomous execution states. */
export type AutonomousExecutionState =
  | 'IDLE'
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'WAITING_PROVIDER'
  | 'RECOVERING'
  | 'COMPLETE'
  | 'FAILED'

/** UI progress phases streamed during long-running work. */
export type AutonomousProgressPhase =
  | 'Thinking'
  | 'Searching'
  | 'Comparing'
  | 'Booking'
  | 'Completed'

export type AutonomousGoalStatus = 'active' | 'blocked' | 'completed' | 'failed'
export type AutonomousTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export type AutonomousTaskKind =
  | 'understand'
  | 'clarify'
  | 'search_flights'
  | 'search_hotels'
  | 'search_weather'
  | 'search_maps'
  | 'search_attractions'
  | 'search_transportation'
  | 'search_currency'
  | 'search_visa'
  | 'compare_options'
  | 'build_plan'
  | 'present'

export interface AutonomousGoal {
  id: string
  conversationId: string
  /** Stable objective label, e.g. "plan_trip:Japan". */
  objective: string
  description: string
  status: AutonomousGoalStatus
  createdAt: string
  updatedAt: string
  /** Critical slots still required before autonomous execution can finish. */
  blockingFields: string[]
}

export interface AutonomousTask {
  id: string
  kind: AutonomousTaskKind
  title: string
  status: AutonomousTaskStatus
  tool?: AgentToolName
  /** Alternative tools/providers to try on failure. */
  alternatives?: AgentToolName[]
  retryCount: number
  maxRetries: number
  providerId?: string
  error?: string | null
  startedAt?: string
  finishedAt?: string
  durationMs?: number
}

export interface AutonomousExecutionPlan {
  id: string
  goalId: string
  tasks: AutonomousTask[]
  createdAt: string
  updatedAt: string
}

export interface AutonomousProgressEvent {
  phase: AutonomousProgressPhase
  state: AutonomousExecutionState
  message: string
  goalId?: string
  activeTaskId?: string
  activeTaskKind?: AutonomousTaskKind
  providerId?: string
  retryCount?: number
  completedTaskIds?: string[]
  pendingTaskIds?: string[]
  at: string
}

export interface AutonomousObservabilityLog {
  at: string
  goal: string | null
  activeTask: string | null
  providerUsed: string | null
  retryCount: number
  durationMs: number
  outcome: 'ok' | 'degraded' | 'failed' | 'blocked' | 'cancelled'
  state: AutonomousExecutionState
  detail?: string
}

/** Additive snapshot persisted on AgentProviderMeta across turns. */
export interface AutonomousAgentSnapshot {
  state: AutonomousExecutionState
  progressPhase: AutonomousProgressPhase
  goal: AutonomousGoal | null
  plan: AutonomousExecutionPlan | null
  completedTaskIds: string[]
  pendingTaskIds: string[]
  lastProviderId: string | null
  totalRetries: number
  durationMs: number
  outcome: AutonomousObservabilityLog['outcome']
  logs: AutonomousObservabilityLog[]
  recoveredFromFailures: boolean
}

export interface AutonomousRunResult {
  state: AutonomousExecutionState
  snapshot: AutonomousAgentSnapshot
  batch: ToolExecutionBatch
  toolResults: AgentToolResult[]
  planBuilt: boolean
  needsClarification: boolean
  clarificationField: string | null
  tripPlan?: TripPlan | null
}
