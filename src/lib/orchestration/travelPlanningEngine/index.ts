/**
 * Phase 7 Stage 7 — AI Travel Planning Engine barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.travel_planning` (default OFF).
 * Distinct from Phase 6 `brain.planning_engine`.
 * Never books — only generates planning structures.
 * No Runtime, LLM, pricing, external APIs, DB, or storage.
 */

import { TRAVEL_PLANNING_ISOLATION as TP_ISOLATION } from './types'
import {
  TRAVEL_PLANNING_INPUT_HINTS,
  TRAVEL_PLANNING_LIFECYCLE_ACTIONS,
  TRAVEL_PLANNING_PIPELINE_STAGES,
  TRAVEL_PLANNING_SECTION_IDS,
} from './types'

export {
  BRAIN_TRAVEL_PLANNING_FEATURE_ID,
  isBrainTravelPlanningEnabled,
  listTravelPlanningRegistry,
  listTravelPlanningSectionIds,
  TravelPlanningRegistry,
  TRAVEL_PLANNING_REGISTRY,
} from './registry'

export type {
  TravelPlanningLocale,
  TravelPlanningSectionId,
  TravelPlanningPipelineStageId,
  TravelPlan,
  PlanningGoal,
  PlanningConstraint,
  PlanningStep,
  PlanningAlternative,
  PlanningScore,
  PlanningConfidence,
  PlanningValidation,
  PlanningRevision,
  PlanningSnapshot,
  PlanningEngineContract,
  PlanningPipelineContract,
  PlanningSchemaContract,
  PlanningValidationContract,
  PlanningLifecycleContract,
  PlanningStrategyContract,
  PlanningConstraintsContract,
  PlanningGoalsContract,
  PlanningPrioritiesContract,
  PlanningRulesContract,
  PlanningTimelineContract,
  PlanningSnapshotContract,
  PlanningConfidenceContract,
  PlanningRevisionContract,
  PlanningVersionContract,
  PlanningAlternativesContract,
  PlanningOptimizationContract,
  TravelPlanningRegistryEntry,
  TravelPlanningBlueprint,
} from './types'

export {
  TRAVEL_PLANNING_ISOLATION,
  TRAVEL_PLANNING_SECTION_IDS,
  TRAVEL_PLANNING_PIPELINE_STAGES,
  TRAVEL_PLANNING_LIFECYCLE_ACTIONS,
  TRAVEL_PLANNING_INPUT_HINTS,
} from './types'

export {
  buildPlanningEngine,
  buildPlanningPipeline,
  buildPlanningSchema,
  buildPlanningValidationContract,
  buildPlanningLifecycle,
  buildPlanningStrategy,
  buildPlanningConstraints,
  buildPlanningGoals,
  buildPlanningPriorities,
  buildPlanningRules,
  buildPlanningTimeline,
  buildPlanningSnapshotContract,
  buildPlanningConfidenceContract,
  buildPlanningRevisionContract,
  buildPlanningVersion,
  buildPlanningAlternatives,
  buildPlanningOptimization,
  buildTravelPlanSample,
  buildPlanningGoalSample,
  buildPlanningConstraintSample,
  buildPlanningStepSample,
  buildPlanningAlternativeSample,
  buildPlanningScoreSample,
  buildPlanningConfidenceSample,
  buildPlanningValidationSample,
  buildPlanningRevisionSample,
  buildPlanningSnapshotSample,
} from './pipelines'

export {
  TravelPlanningEngine,
  buildTravelPlanningBlueprint,
  tryBuildTravelPlanningBlueprint,
  assertTravelPlanningIsolation,
} from './engine'
export type { BuildTravelPlanningBlueprintOptions } from './engine'

export const TRAVEL_PLANNING_ARCHITECTURE = {
  version: '7.7.0-travel-planning',
  featureId: 'brain.travel_planning' as const,
  architectureOnly: true,
  components: [
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
    'travel_plan_output',
    'planning_goal_output',
    'planning_constraint_output',
    'planning_step_output',
    'planning_alternative_output',
    'planning_score_output',
    'planning_confidence_output',
    'planning_validation_output',
    'planning_revision_output',
    'planning_snapshot_output',
  ] as const,
  pipelineStages: TRAVEL_PLANNING_PIPELINE_STAGES,
  lifecycleActions: TRAVEL_PLANNING_LIFECYCLE_ACTIONS,
  inputHints: TRAVEL_PLANNING_INPUT_HINTS,
  sectionIds: TRAVEL_PLANNING_SECTION_IDS,
  ...TP_ISOLATION,
} as const
