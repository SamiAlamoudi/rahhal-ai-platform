/**
 * Phase 6 Stage 3 — AI Planning Engine barrel.
 *
 * Architecture / contracts / types only.
 * Gated by `brain.planning_engine` (default OFF).
 * No planning execution, LLM, Runtime, booking APIs, or production wiring.
 */

import { PLANNING_ENGINE_ISOLATION as PE_ISOLATION } from './types'
import { PLANNING_PIPELINE_STAGES } from './types'

export {
  BRAIN_PLANNING_ENGINE_FEATURE_ID,
  isBrainPlanningEngineEnabled,
  listPlanningRegistry,
  listPlanningModuleHints,
  PlanningRegistry,
  PLANNING_REGISTRY,
} from './registry'

export type {
  PlanningLocale,
  PlanningStateId,
  PlanningEventKind,
  PlanningConfidenceBand,
  PlanningModuleHint,
  PlanningEngineContract,
  PlanningPipelineStageId,
  PlanningPipelineContract,
  TripPlannerContract,
  DestinationSelectorContract,
  ItineraryDayContract,
  ItineraryGeneratorContract,
  BudgetPlannerContract,
  ScheduleOptimizerContract,
  TransportationPlannerContract,
  AccommodationPlannerContract,
  ActivityPlannerContract,
  RiskAnalyzerContract,
  ConstraintEngineContract,
  PreferenceMatcherContract,
  AlternativeGeneratorContract,
  ScenarioBuilderContract,
  PlanningContextContract,
  PlanningSessionContract,
  PlanningRegistryEntry,
  PlanningEventContract,
  PlanningAnalyticsContract,
  PlanningStateTransition,
  PlanningStateMachineContract,
  PlanningConfidenceModelContract,
  PlanningEngineBlueprint,
} from './types'

export {
  PLANNING_ENGINE_ISOLATION,
  PLANNING_PIPELINE_STAGES,
  PLANNING_STATE_IDS,
  PLANNING_MODULE_HINTS,
} from './types'

export {
  buildPlanningEngine,
  buildPlanningPipeline,
  buildTripPlanner,
  buildDestinationSelector,
  buildItineraryGenerator,
  buildBudgetPlanner,
  buildScheduleOptimizer,
  buildTransportationPlanner,
  buildAccommodationPlanner,
  buildActivityPlanner,
  buildRiskAnalyzer,
  buildConstraintEngine,
  buildPreferenceMatcher,
  buildAlternativeGenerator,
  buildScenarioBuilder,
  buildPlanningContext,
  buildPlanningSession,
  buildPlanningStateMachine,
  buildPlanningConfidenceModel,
  buildPlanningEvent,
  buildPlanningAnalytics,
} from './pipelines'

export {
  PlanningEngine,
  buildPlanningEngineBlueprint,
  tryBuildPlanningEngineBlueprint,
  assertPlanningEngineIsolation,
} from './engine'
export type { BuildPlanningBlueprintOptions } from './engine'

export const PLANNING_ENGINE_ARCHITECTURE = {
  version: '6.3.0-planning-engine',
  featureId: 'brain.planning_engine' as const,
  architectureOnly: true,
  components: [
    'planning_engine',
    'planning_pipeline',
    'trip_planner',
    'destination_selector',
    'itinerary_generator',
    'budget_planner',
    'schedule_optimizer',
    'transportation_planner',
    'accommodation_planner',
    'activity_planner',
    'risk_analyzer',
    'constraint_engine',
    'preference_matcher',
    'alternative_generator',
    'scenario_builder',
    'planning_context',
    'planning_session',
    'planning_registry',
    'planning_events',
    'planning_analytics',
    'planning_state_machine',
    'planning_confidence_model',
  ] as const,
  pipelineStages: PLANNING_PIPELINE_STAGES,
  ...PE_ISOLATION,
} as const
