/**
 * Planning Engine facade — builds architecture blueprints only.
 * Never plans trips, calls LLMs, Runtime, or booking APIs.
 */

import { listPlanningRegistry } from './registry'
import { isBrainPlanningEngineEnabled } from './registry'
import {
  buildAccommodationPlanner,
  buildActivityPlanner,
  buildAlternativeGenerator,
  buildBudgetPlanner,
  buildConstraintEngine,
  buildDestinationSelector,
  buildItineraryGenerator,
  buildPlanningAnalytics,
  buildPlanningConfidenceModel,
  buildPlanningContext,
  buildPlanningEngine,
  buildPlanningEvent,
  buildPlanningPipeline,
  buildPlanningSession,
  buildPlanningStateMachine,
  buildPreferenceMatcher,
  buildRiskAnalyzer,
  buildScenarioBuilder,
  buildScheduleOptimizer,
  buildTransportationPlanner,
  buildTripPlanner,
} from './pipelines'
import type { PlanningEngineBlueprint, PlanningLocale } from './types'
import { PLANNING_ENGINE_ISOLATION } from './types'

export interface BuildPlanningBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: PlanningLocale
}

export function buildPlanningEngineBlueprint(
  options: BuildPlanningBlueprintOptions = {},
): PlanningEngineBlueprint {
  const sessionId = options.sessionId ?? 'planning-session-architecture'
  const locale = options.locale ?? 'ar'

  return {
    version: '6.3.0-planning-engine',
    featureId: 'brain.planning_engine',
    architectureOnly: true,
    engine: buildPlanningEngine(),
    pipeline: buildPlanningPipeline(),
    tripPlanner: buildTripPlanner(),
    destinationSelector: buildDestinationSelector(),
    itineraryGenerator: buildItineraryGenerator(),
    budgetPlanner: buildBudgetPlanner(),
    scheduleOptimizer: buildScheduleOptimizer(),
    transportationPlanner: buildTransportationPlanner(),
    accommodationPlanner: buildAccommodationPlanner(),
    activityPlanner: buildActivityPlanner(),
    riskAnalyzer: buildRiskAnalyzer(),
    constraintEngine: buildConstraintEngine(),
    preferenceMatcher: buildPreferenceMatcher(),
    alternativeGenerator: buildAlternativeGenerator(),
    scenarioBuilder: buildScenarioBuilder(),
    planningContext: buildPlanningContext(sessionId, locale),
    planningSession: buildPlanningSession(sessionId, locale),
    events: [
      buildPlanningEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildPlanningEvent(sessionId, 'context_attached', 'empty context'),
    ],
    analytics: buildPlanningAnalytics(sessionId),
    stateMachine: buildPlanningStateMachine(),
    confidence: buildPlanningConfidenceModel(0.5),
    registry: listPlanningRegistry(),
  }
}

export function tryBuildPlanningEngineBlueprint(
  options: BuildPlanningBlueprintOptions = {},
): PlanningEngineBlueprint | null {
  if (!isBrainPlanningEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildPlanningEngineBlueprint(options)
}

export function assertPlanningEngineIsolation(): typeof PLANNING_ENGINE_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...PLANNING_ENGINE_ISOLATION,
    architectureOnly: true,
    registrySize: listPlanningRegistry().length,
  }
}

export const PlanningEngine = {
  buildBlueprint: buildPlanningEngineBlueprint,
  tryBuildBlueprint: tryBuildPlanningEngineBlueprint,
  assertIsolation: assertPlanningEngineIsolation,
}
