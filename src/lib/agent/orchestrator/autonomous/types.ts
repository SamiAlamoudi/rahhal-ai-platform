/**
 * Phase 6 — Autonomous AI Agent Orchestrator models.
 * Mission / multi-step execution. No production APIs. Additive only.
 */

export type MissionLocale = 'ar' | 'en'

export type MissionStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'waiting_approval'
  | 'replanning'
  | 'recovering'
  | 'completed'
  | 'cancelled'

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'blocked'
  | 'waiting'
  | 'retry'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'skipped'

export type TaskKind =
  | 'understand_request'
  | 'collect_missing'
  | 'determine_season'
  | 'estimate_budget'
  | 'flight_strategy'
  | 'hotel_strategy'
  | 'activities'
  | 'visa_check'
  | 'search'
  | 'compare'
  | 'reason'
  | 'recommend'
  | 'wait_approval'
  | 'build_itinerary'

export type AgentToolId =
  | 'flights'
  | 'hotels'
  | 'weather'
  | 'visa'
  | 'maps'
  | 'currency'
  | 'restaurants'
  | 'activities'
  | 'transportation'
  | 'emergency'
  | 'insurance'
  | 'none'

export type PriorityLevel = 'urgent' | 'high' | 'normal' | 'deferred'

export type WorkflowPhase =
  | 'searching'
  | 'comparing'
  | 'planning'
  | 'waiting'
  | 'retry'
  | 'resume'
  | 'cancel'
  | 'idle'

export interface TravelGoal {
  destination: string | null
  purpose: string | null
  budgetAmount: number | null
  currency: string | null
  durationDays: number | null
  monthHint: string | null
  travelers: number | null
  notes: string[]
  version: number
}

export interface MissionTask {
  id: string
  kind: TaskKind
  title: string
  status: TaskStatus
  priority: PriorityLevel
  tool: AgentToolId
  dependsOn: string[]
  unblockQuestion: string | null
  estimateOnly: boolean
  explanation: string
  resultSummary: string | null
}

export interface MissionPlan {
  id: string
  title: string
  goal: TravelGoal
  tasks: MissionTask[]
  status: MissionStatus
  createdAt: string
  updatedAt: string
}

export interface ExecutionStateSnapshot {
  missionId: string
  phase: WorkflowPhase
  currentTaskId: string | null
  completedTaskIds: string[]
  blockedTaskIds: string[]
  retryCounts: Record<string, number>
  waitingForApproval: boolean
  lastError: string | null
}

export interface ToolRouteDecision {
  tool: AgentToolId
  reason: string
  priority: PriorityLevel
  fallbackTools: AgentToolId[]
}

export interface DecisionRecord {
  id: string
  topic: string
  choice: string
  why: string
  /** Debug-only — never shown in production UI */
  debugOnly: true
}

export interface RecoveryAction {
  kind: 'retry_tool' | 'use_fallback_tool' | 'continue_with_estimate' | 'ask_clarification' | 'replan'
  detail: string
  tool?: AgentToolId
}

export interface ExecutionMemorySnapshot {
  conversationFacts: string[]
  preferenceFacts: string[]
  taskFacts: string[]
  profileFacts: string[]
  goalVersions: TravelGoal[]
}

export interface OrchestratorTimelineEntry {
  at: string
  kind: 'mission' | 'task' | 'execution' | 'reasoning' | 'tool' | 'recovery' | 'replan'
  label: string
  detail: string
}

export interface AutonomousOrchestratorResult {
  enabled: true
  locale: MissionLocale
  mission: MissionPlan
  execution: ExecutionStateSnapshot
  memory: ExecutionMemorySnapshot
  toolDecision: ToolRouteDecision
  decisions: DecisionRecord[]
  recoveries: RecoveryAction[]
  clarifications: string[]
  timeline: OrchestratorTimelineEntry[]
  replanned: boolean
  replyPreview: string
}

export interface AutonomousOrchestratorInput {
  userText: string
  locale?: MissionLocale
  priorMission?: MissionPlan | null
  priorExecution?: ExecutionStateSnapshot | null
  priorMemory?: ExecutionMemorySnapshot | null
  recentTexts?: string[]
}
