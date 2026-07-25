/**
 * Phase 7 Stage 7 — AI Travel Planning Engine contracts.
 * Architecture / interfaces / types / blueprints only.
 * Transforms profile/context/intent/preferences into planning structures.
 * Never books, prices, or calls external APIs.
 */

export type TravelPlanningLocale = 'ar' | 'en'

export type TravelPlanningSectionId =
  | 'planning_engine'
  | 'planning_pipeline'
  | 'planning_schema'
  | 'planning_validation'
  | 'planning_lifecycle'
  | 'planning_strategy'
  | 'planning_constraints'
  | 'planning_goals'
  | 'planning_priorities'
  | 'planning_rules'
  | 'planning_timeline'
  | 'planning_snapshot'
  | 'planning_confidence'
  | 'planning_revision'
  | 'planning_version'
  | 'planning_alternatives'
  | 'planning_optimization'

/** Output contracts */
export interface TravelPlan {
  kind: 'travel_plan'
  planId: string
  destinationHint: string | null
  dateHints: readonly string[]
  budgetHint: string | null
  execution: 'none'
  books: false
}

export interface PlanningGoal {
  kind: 'planning_goal'
  goalId: string
  goalHint: string
  execution: 'none'
}

export interface PlanningConstraint {
  kind: 'planning_constraint'
  constraintId: string
  constraintHint: string
  hardHint: boolean
  execution: 'none'
}

export interface PlanningStep {
  kind: 'planning_step'
  stepId: string
  stageHint: string
  summaryHint: string
  execution: 'none'
}

export interface PlanningAlternative {
  kind: 'planning_alternative'
  alternativeId: string
  labelHint: string
  execution: 'none'
}

export interface PlanningScore {
  kind: 'planning_score'
  planId: string
  scoreHint: number
  execution: 'none'
}

export interface PlanningConfidence {
  kind: 'planning_confidence'
  planId: string
  scoreHint: number
  bandHint: 'low' | 'medium' | 'high'
  execution: 'none'
}

export interface PlanningValidation {
  kind: 'planning_validation'
  planId: string
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

export interface PlanningRevision {
  kind: 'planning_revision'
  revisionId: string
  planId: string
  reasonHint: string
  execution: 'none'
}

export interface PlanningSnapshot {
  kind: 'planning_snapshot'
  snapshotId: string
  atIso: string
  planId: string | null
  versionHint: number
  execution: 'none'
}

export interface PlanningEngineContract {
  kind: 'travel_planning_engine'
  version: '7.7.0-travel-planning'
  execution: 'none'
  books: false
}

export interface PlanningPipelineContract {
  kind: 'travel_planning_pipeline'
  stages: readonly string[]
  execution: 'none'
}

export interface PlanningSchemaContract {
  kind: 'travel_planning_schema'
  outputKinds: readonly string[]
  execution: 'none'
}

export interface PlanningValidationContract {
  kind: 'travel_planning_validation'
  validation: PlanningValidation
  execution: 'none'
}

export interface PlanningLifecycleContract {
  kind: 'travel_planning_lifecycle'
  actions: readonly string[]
  currentActionHint: string | null
  execution: 'none'
}

export interface PlanningStrategyContract {
  kind: 'travel_planning_strategy'
  strategyHints: readonly string[]
  execution: 'none'
}

export interface PlanningConstraintsContract {
  kind: 'travel_planning_constraints'
  constraints: readonly PlanningConstraint[]
  execution: 'none'
}

export interface PlanningGoalsContract {
  kind: 'travel_planning_goals'
  goals: readonly PlanningGoal[]
  execution: 'none'
}

export interface PlanningPrioritiesContract {
  kind: 'travel_planning_priorities'
  priorityHints: readonly string[]
  execution: 'none'
}

export interface PlanningRulesContract {
  kind: 'travel_planning_rules'
  ruleHints: readonly string[]
  execution: 'none'
}

export interface PlanningTimelineContract {
  kind: 'travel_planning_timeline'
  steps: readonly PlanningStep[]
  execution: 'none'
}

export interface PlanningSnapshotContract {
  kind: 'travel_planning_snapshot'
  snapshot: PlanningSnapshot
  execution: 'none'
}

export interface PlanningConfidenceContract {
  kind: 'travel_planning_confidence'
  confidence: PlanningConfidence
  execution: 'none'
}

export interface PlanningRevisionContract {
  kind: 'travel_planning_revision'
  revisions: readonly PlanningRevision[]
  persisted: false
  execution: 'none'
}

export interface PlanningVersionContract {
  kind: 'travel_planning_version'
  version: number
  previousVersion: number | null
  execution: 'none'
}

export interface PlanningAlternativesContract {
  kind: 'travel_planning_alternatives'
  alternatives: readonly PlanningAlternative[]
  execution: 'none'
}

export interface PlanningOptimizationContract {
  kind: 'travel_planning_optimization'
  optimizationHints: readonly string[]
  executed: false
  execution: 'none'
}

export interface TravelPlanningRegistryEntry {
  id: string
  sectionId: TravelPlanningSectionId
  label: string
  enabledHint: false
}

export interface TravelPlanningBlueprint {
  version: '7.7.0-travel-planning'
  featureId: 'brain.travel_planning'
  architectureOnly: true
  engine: PlanningEngineContract
  pipeline: PlanningPipelineContract
  schema: PlanningSchemaContract
  validation: PlanningValidationContract
  lifecycle: PlanningLifecycleContract
  strategy: PlanningStrategyContract
  constraints: PlanningConstraintsContract
  goals: PlanningGoalsContract
  priorities: PlanningPrioritiesContract
  rules: PlanningRulesContract
  timeline: PlanningTimelineContract
  snapshot: PlanningSnapshotContract
  confidence: PlanningConfidenceContract
  revision: PlanningRevisionContract
  versioning: PlanningVersionContract
  alternatives: PlanningAlternativesContract
  optimization: PlanningOptimizationContract
  /** Output contract samples */
  travelPlan: TravelPlan
  planningGoal: PlanningGoal
  planningConstraint: PlanningConstraint
  planningStep: PlanningStep
  planningAlternative: PlanningAlternative
  planningScore: PlanningScore
  planningConfidence: PlanningConfidence
  planningValidation: PlanningValidation
  planningRevision: PlanningRevision
  planningSnapshot: PlanningSnapshot
  registry: readonly TravelPlanningRegistryEntry[]
  /** Upstream input hints (architecture references only). */
  inputHints: readonly string[]
}

export const TRAVEL_PLANNING_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoRuntime: false,
  wiredIntoLlms: false,
  booking: false,
  pricing: false,
  wiredIntoExternalApis: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  businessLogic: false,
  distinctFromPhase6PlanningEngine: true,
} as const

export const TRAVEL_PLANNING_SECTION_IDS: readonly TravelPlanningSectionId[] = [
  'planning_engine',
  'planning_pipeline',
  'planning_schema',
  'planning_validation',
  'planning_lifecycle',
  'planning_strategy',
  'planning_constraints',
  'planning_goals',
  'planning_priorities',
  'planning_rules',
  'planning_timeline',
  'planning_snapshot',
  'planning_confidence',
  'planning_revision',
  'planning_version',
  'planning_alternatives',
  'planning_optimization',
] as const

export const TRAVEL_PLANNING_PIPELINE_STAGES = [
  'attach_traveler_profile',
  'attach_conversation_context',
  'attach_intent',
  'attach_preferences',
  'attach_budget',
  'attach_dates',
  'attach_destination',
  'define_goals',
  'apply_constraints',
  'apply_priorities',
  'apply_strategy',
  'build_plan_structure',
  'generate_alternatives',
  'hint_optimization',
  'score_confidence',
  'validate',
  'version',
  'snapshot',
] as const

export type TravelPlanningPipelineStageId =
  (typeof TRAVEL_PLANNING_PIPELINE_STAGES)[number]

export const TRAVEL_PLANNING_LIFECYCLE_ACTIONS = [
  'draft',
  'structure',
  'revise',
  'validate',
  'snapshot',
  'close',
] as const

export const TRAVEL_PLANNING_INPUT_HINTS = [
  'traveler_profile',
  'conversation_context',
  'intent',
  'preferences',
  'budget',
  'dates',
  'destination',
] as const
