/**
 * Travel Planning Engine facade — builds architecture blueprints only.
 * Never books, prices, calls LLMs, or executes plans.
 */

import { listTravelPlanningRegistry } from './registry'
import { isBrainTravelPlanningEnabled } from './registry'
import {
  buildPlanningAlternatives,
  buildPlanningAlternativeSample,
  buildPlanningConfidenceContract,
  buildPlanningConstraintSample,
  buildPlanningConstraints,
  buildPlanningEngine,
  buildPlanningGoalSample,
  buildPlanningGoals,
  buildPlanningLifecycle,
  buildPlanningOptimization,
  buildPlanningPipeline,
  buildPlanningPriorities,
  buildPlanningRevisionContract,
  buildPlanningRevisionSample,
  buildPlanningRules,
  buildPlanningSchema,
  buildPlanningScoreSample,
  buildPlanningSnapshotContract,
  buildPlanningStepSample,
  buildPlanningStrategy,
  buildPlanningTimeline,
  buildPlanningValidationContract,
  buildPlanningVersion,
  buildTravelPlanSample,
} from './pipelines'
import type {
  TravelPlanningBlueprint,
  TravelPlanningLocale,
} from './types'
import {
  TRAVEL_PLANNING_INPUT_HINTS,
  TRAVEL_PLANNING_ISOLATION,
} from './types'

export interface BuildTravelPlanningBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: TravelPlanningLocale
}

export function buildTravelPlanningBlueprint(
  options: BuildTravelPlanningBlueprintOptions = {},
): TravelPlanningBlueprint {
  void options.sessionId
  void options.locale

  const validation = buildPlanningValidationContract()
  const confidence = buildPlanningConfidenceContract()
  const snapshot = buildPlanningSnapshotContract()

  return {
    version: '7.7.0-travel-planning',
    featureId: 'brain.travel_planning',
    architectureOnly: true,
    engine: buildPlanningEngine(),
    pipeline: buildPlanningPipeline(),
    schema: buildPlanningSchema(),
    validation,
    lifecycle: buildPlanningLifecycle(),
    strategy: buildPlanningStrategy(),
    constraints: buildPlanningConstraints(),
    goals: buildPlanningGoals(),
    priorities: buildPlanningPriorities(),
    rules: buildPlanningRules(),
    timeline: buildPlanningTimeline(),
    snapshot,
    confidence,
    revision: buildPlanningRevisionContract(),
    versioning: buildPlanningVersion(),
    alternatives: buildPlanningAlternatives(),
    optimization: buildPlanningOptimization(),
    travelPlan: buildTravelPlanSample(),
    planningGoal: buildPlanningGoalSample(),
    planningConstraint: buildPlanningConstraintSample(),
    planningStep: buildPlanningStepSample(),
    planningAlternative: buildPlanningAlternativeSample(),
    planningScore: buildPlanningScoreSample(),
    planningConfidence: confidence.confidence,
    planningValidation: validation.validation,
    planningRevision: buildPlanningRevisionSample(),
    planningSnapshot: snapshot.snapshot,
    registry: listTravelPlanningRegistry(),
    inputHints: TRAVEL_PLANNING_INPUT_HINTS,
  }
}

export function tryBuildTravelPlanningBlueprint(
  options: BuildTravelPlanningBlueprintOptions = {},
): TravelPlanningBlueprint | null {
  if (!isBrainTravelPlanningEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildTravelPlanningBlueprint(options)
}

export function assertTravelPlanningIsolation(): typeof TRAVEL_PLANNING_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...TRAVEL_PLANNING_ISOLATION,
    architectureOnly: true,
    registrySize: listTravelPlanningRegistry().length,
  }
}

export const TravelPlanningEngine = {
  buildBlueprint: buildTravelPlanningBlueprint,
  tryBuildBlueprint: tryBuildTravelPlanningBlueprint,
  assertIsolation: assertTravelPlanningIsolation,
}
