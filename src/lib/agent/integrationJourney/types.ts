/**
 * Integration Sprint 12 — End-to-End Journey contracts.
 * Coordinator only — not a new standalone product feature.
 */

export const INTEGRATION_JOURNEY_VERSION = '1.0.0-integration-journey'

/** Mission chain stage IDs (planning → execution → completion). */
export type JourneyStageId =
  | 'conversation'
  | 'intent'
  | 'planner'
  | 'destination'
  | 'flights'
  | 'hotels'
  | 'budget'
  | 'orchestrator'
  | 'maps'
  | 'companion'
  | 'action'
  | 'disruption'
  | 'completion'

export const JOURNEY_STAGE_ORDER: JourneyStageId[] = [
  'conversation',
  'intent',
  'planner',
  'destination',
  'flights',
  'hotels',
  'budget',
  'orchestrator',
  'maps',
  'companion',
  'action',
  'disruption',
  'completion',
]

export type JourneyStageStatus =
  | 'ready'
  | 'active'
  | 'completed'
  | 'skipped'
  | 'blocked'

export type JourneyScenario =
  | 'business'
  | 'family'
  | 'luxury'
  | 'weekend'
  | 'budget'
  | 'multi_city'
  | 'disruption_recovery'
  | 'leisure'

export interface JourneyHandoffContext {
  conversationId: string | null
  locale: 'ar' | 'en'
  scenario: JourneyScenario
  stage: JourneyStageId
  previousDecisions: string[]
  knownSlots: string[]
  missingSlots: string[]
  destination: string | null
  origin: string | null
  budgetAmount: number | null
  budgetCurrency: string | null
  travelers: number | null
  hasTripPlan: boolean
  hasFlights: boolean
  hasHotels: boolean
  travelerState: 'planning' | 'booking' | 'traveling' | 'recovering' | 'complete'
}

export interface JourneySharedDecision {
  overall: number
  budget: number
  timeline: number
  flights: number
  hotels: number
  maps: number
  risk: number
  preference: number
  rationaleEn: string
  rationaleAr: string
}

export interface JourneyStageTrace {
  stage: JourneyStageId
  status: JourneyStageStatus
  moduleId: string
  latencyMs: number
  note: string
  childFlagOn: boolean
}

export interface JourneyConversationTrace {
  turn: number
  userText: string | null
  inferredIntent: string
  stage: JourneyStageId
  avoidedDuplicateQuestions: string[]
}

export interface JourneyDecisionTrace {
  stage: JourneyStageId
  decision: JourneySharedDecision
  inputs: string[]
}

export interface JourneyExecutionTrace {
  stage: JourneyStageId
  action: string | null
  mode: string | null
  reference: string | null
  ok: boolean
}

export interface JourneyObservability {
  conversation: JourneyConversationTrace[]
  decision: JourneyDecisionTrace[]
  execution: JourneyExecutionTrace[]
}

export interface JourneyMemorySnapshot {
  stage: JourneyStageId
  scenario: JourneyScenario
  knownSlots: string[]
  previousDecisions: string[]
  completedStages: JourneyStageId[]
  turn: number
}

export interface JourneyResult {
  version: string
  enabled: boolean
  ok: boolean
  stage: JourneyStageId
  scenario: JourneyScenario
  handoff: JourneyHandoffContext
  decision: JourneySharedDecision
  stages: JourneyStageTrace[]
  observability: JourneyObservability
  memory: JourneyMemorySnapshot
  consultantSummaryEn: string
  consultantSummaryAr: string
  latencyMs: number
  logs: string[]
}
