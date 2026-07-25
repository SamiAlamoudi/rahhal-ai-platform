/**
 * Phase 6 Stage 3 — AI Planning Engine contracts.
 * Architecture / interfaces / types only. No LLM, planning execution, or APIs.
 */

export type PlanningLocale = 'ar' | 'en'

export type PlanningStateId =
  | 'idle'
  | 'collecting_context'
  | 'selecting_destination'
  | 'building_itinerary'
  | 'optimizing_schedule'
  | 'scoring_plan'
  | 'generating_alternatives'
  | 'ready'
  | 'closed'

export type PlanningEventKind =
  | 'session_started'
  | 'context_attached'
  | 'destination_selected'
  | 'itinerary_drafted'
  | 'budget_scored'
  | 'schedule_optimized'
  | 'risk_analyzed'
  | 'alternatives_ready'
  | 'confidence_scored'
  | 'state_transition'
  | 'session_ended'

export type PlanningConfidenceBand = 'low' | 'medium' | 'high'

export type PlanningModuleHint =
  | 'travel_workspace'
  | 'journey_timeline'
  | 'decision_center'
  | 'insights_center'
  | 'booking_hub'
  | 'traveler_profile'
  | 'memory_center'
  | 'conversation_center'

export interface PlanningEngineContract {
  kind: 'planning_engine'
  version: '6.3.0-planning-engine'
  execution: 'none'
}

export interface PlanningPipelineStageId =
  | 'attach_context'
  | 'match_preferences'
  | 'apply_constraints'
  | 'select_destination'
  | 'plan_transport'
  | 'plan_accommodation'
  | 'plan_activities'
  | 'build_itinerary'
  | 'optimize_schedule'
  | 'plan_budget'
  | 'analyze_risk'
  | 'generate_alternatives'
  | 'build_scenarios'
  | 'score_confidence'

export interface PlanningPipelineContract {
  kind: 'planning_pipeline'
  stages: readonly PlanningPipelineStageId[]
  execution: 'none'
}

export interface TripPlannerContract {
  kind: 'trip_planner'
  tripLabel: string
  nights: number
  travelerCount: number
  moduleHints: readonly PlanningModuleHint[]
  execution: 'none'
}

export interface DestinationSelectorContract {
  kind: 'destination_selector'
  candidates: readonly string[]
  selectedHint: string | null
  execution: 'none'
}

export interface ItineraryDayContract {
  dayIndex: number
  label: string
  blocks: readonly string[]
}

export interface ItineraryGeneratorContract {
  kind: 'itinerary_generator'
  days: readonly ItineraryDayContract[]
  execution: 'none'
}

export interface BudgetPlannerContract {
  kind: 'budget_planner'
  currencyHint: string
  totalHint: string
  buckets: readonly { id: string; label: string; sharePercent: number }[]
  execution: 'none'
}

export interface ScheduleOptimizerContract {
  kind: 'schedule_optimizer'
  objectives: readonly string[]
  conflicts: readonly string[]
  execution: 'none'
}

export interface TransportationPlannerContract {
  kind: 'transportation_planner'
  legs: readonly { id: string; modeHint: string; from: string; to: string }[]
  execution: 'none'
}

export interface AccommodationPlannerContract {
  kind: 'accommodation_planner'
  stays: readonly { id: string; areaHint: string; nights: number }[]
  execution: 'none'
}

export interface ActivityPlannerContract {
  kind: 'activity_planner'
  activities: readonly { id: string; label: string; dayIndex: number }[]
  execution: 'none'
}

export interface RiskAnalyzerContract {
  kind: 'risk_analyzer'
  risks: readonly { id: string; label: string; severity: 'low' | 'medium' | 'high' }[]
  execution: 'none'
}

export interface ConstraintEngineContract {
  kind: 'constraint_engine'
  hard: readonly string[]
  soft: readonly string[]
  execution: 'none'
}

export interface PreferenceMatcherContract {
  kind: 'preference_matcher'
  matched: readonly string[]
  unmatched: readonly string[]
  execution: 'none'
}

export interface AlternativeGeneratorContract {
  kind: 'alternative_generator'
  alternatives: readonly { id: string; label: string; tradeoff: string }[]
  execution: 'none'
}

export interface ScenarioBuilderContract {
  kind: 'scenario_builder'
  scenarios: readonly { id: string; label: string; assumptions: readonly string[] }[]
  execution: 'none'
}

export interface PlanningContextContract {
  kind: 'planning_context'
  sessionId: string
  locale: PlanningLocale
  destinationHints: readonly string[]
  dateHints: readonly string[]
  budgetHints: readonly string[]
  preferenceHints: readonly string[]
  moduleHints: readonly PlanningModuleHint[]
}

export interface PlanningSessionContract {
  kind: 'planning_session'
  sessionId: string
  locale: PlanningLocale
  openedAtIso: string
  stateId: PlanningStateId
}

export interface PlanningRegistryEntry {
  id: string
  component:
    | 'trip_planner'
    | 'destination_selector'
    | 'itinerary_generator'
    | 'budget_planner'
    | 'schedule_optimizer'
    | 'transportation_planner'
    | 'accommodation_planner'
    | 'activity_planner'
    | 'risk_analyzer'
    | 'constraint_engine'
    | 'preference_matcher'
    | 'alternative_generator'
    | 'scenario_builder'
  moduleHints: readonly PlanningModuleHint[]
}

export interface PlanningEventContract {
  kind: 'planning_event'
  eventId: string
  eventKind: PlanningEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface PlanningAnalyticsContract {
  kind: 'planning_analytics'
  sessionId: string
  stageCount: number
  alternativeCount: number
  averageConfidence: number
  exported: false
}

export interface PlanningStateTransition {
  from: PlanningStateId
  to: PlanningStateId
  reason: string
}

export interface PlanningStateMachineContract {
  kind: 'planning_state_machine'
  current: PlanningStateId
  allowed: readonly PlanningStateId[]
  lastTransition: PlanningStateTransition | null
  execution: 'none'
}

export interface PlanningConfidenceModelContract {
  kind: 'planning_confidence_model'
  score: number
  band: PlanningConfidenceBand
  factors: readonly string[]
  execution: 'none'
}

export interface PlanningEngineBlueprint {
  version: '6.3.0-planning-engine'
  featureId: 'brain.planning_engine'
  architectureOnly: true
  engine: PlanningEngineContract
  pipeline: PlanningPipelineContract
  tripPlanner: TripPlannerContract
  destinationSelector: DestinationSelectorContract
  itineraryGenerator: ItineraryGeneratorContract
  budgetPlanner: BudgetPlannerContract
  scheduleOptimizer: ScheduleOptimizerContract
  transportationPlanner: TransportationPlannerContract
  accommodationPlanner: AccommodationPlannerContract
  activityPlanner: ActivityPlannerContract
  riskAnalyzer: RiskAnalyzerContract
  constraintEngine: ConstraintEngineContract
  preferenceMatcher: PreferenceMatcherContract
  alternativeGenerator: AlternativeGeneratorContract
  scenarioBuilder: ScenarioBuilderContract
  planningContext: PlanningContextContract
  planningSession: PlanningSessionContract
  events: readonly PlanningEventContract[]
  analytics: PlanningAnalyticsContract
  stateMachine: PlanningStateMachineContract
  confidence: PlanningConfidenceModelContract
  registry: readonly PlanningRegistryEntry[]
}

export const PLANNING_ENGINE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoOpenAi: false,
  wiredIntoClaude: false,
  wiredIntoGemini: false,
  wiredIntoLlms: false,
  wiredIntoBookingApis: false,
  wiredIntoAmadeus: false,
  wiredIntoMaps: false,
  wiredIntoWeather: false,
  wiredIntoPayments: false,
  wiredIntoFirebase: false,
  wiredIntoSupabase: false,
  wiredIntoRealtime: false,
  wiredIntoNotifications: false,
  wiredIntoAuthentication: false,
  wiredIntoRuntime: false,
  wiredIntoDatabase: false,
  planningExecution: false,
  aiReasoning: false,
  llmImplementation: false,
  businessLogic: false,
} as const

export const PLANNING_PIPELINE_STAGES: readonly PlanningPipelineStageId[] = [
  'attach_context',
  'match_preferences',
  'apply_constraints',
  'select_destination',
  'plan_transport',
  'plan_accommodation',
  'plan_activities',
  'build_itinerary',
  'optimize_schedule',
  'plan_budget',
  'analyze_risk',
  'generate_alternatives',
  'build_scenarios',
  'score_confidence',
] as const

export const PLANNING_STATE_IDS: readonly PlanningStateId[] = [
  'idle',
  'collecting_context',
  'selecting_destination',
  'building_itinerary',
  'optimizing_schedule',
  'scoring_plan',
  'generating_alternatives',
  'ready',
  'closed',
] as const

export const PLANNING_MODULE_HINTS: readonly PlanningModuleHint[] = [
  'travel_workspace',
  'journey_timeline',
  'decision_center',
  'insights_center',
  'booking_hub',
  'traveler_profile',
  'memory_center',
  'conversation_center',
] as const
