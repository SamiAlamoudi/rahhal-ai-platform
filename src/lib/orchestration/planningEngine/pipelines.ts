/**
 * Planning pipeline & component contracts — pure builders, no execution.
 */

import type {
  AccommodationPlannerContract,
  ActivityPlannerContract,
  AlternativeGeneratorContract,
  BudgetPlannerContract,
  ConstraintEngineContract,
  DestinationSelectorContract,
  ItineraryGeneratorContract,
  PlanningAnalyticsContract,
  PlanningConfidenceModelContract,
  PlanningContextContract,
  PlanningEventContract,
  PlanningLocale,
  PlanningPipelineContract,
  PlanningSessionContract,
  PlanningStateMachineContract,
  PreferenceMatcherContract,
  RiskAnalyzerContract,
  ScenarioBuilderContract,
  ScheduleOptimizerContract,
  TransportationPlannerContract,
  TripPlannerContract,
  PlanningEngineContract,
} from './types'
import {
  PLANNING_MODULE_HINTS,
  PLANNING_PIPELINE_STAGES,
  PLANNING_STATE_IDS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildPlanningEngine(): PlanningEngineContract {
  return {
    kind: 'planning_engine',
    version: '6.3.0-planning-engine',
    execution: 'none',
  }
}

export function buildPlanningPipeline(): PlanningPipelineContract {
  return {
    kind: 'planning_pipeline',
    stages: PLANNING_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildTripPlanner(): TripPlannerContract {
  return {
    kind: 'trip_planner',
    tripLabel: 'Architecture trip plan',
    nights: 0,
    travelerCount: 0,
    moduleHints: ['travel_workspace', 'journey_timeline'],
    execution: 'none',
  }
}

export function buildDestinationSelector(): DestinationSelectorContract {
  return {
    kind: 'destination_selector',
    candidates: [],
    selectedHint: null,
    execution: 'none',
  }
}

export function buildItineraryGenerator(): ItineraryGeneratorContract {
  return {
    kind: 'itinerary_generator',
    days: [],
    execution: 'none',
  }
}

export function buildBudgetPlanner(): BudgetPlannerContract {
  return {
    kind: 'budget_planner',
    currencyHint: 'SAR',
    totalHint: '0',
    buckets: [
      { id: 'flights', label: 'flights', sharePercent: 40 },
      { id: 'hotels', label: 'hotels', sharePercent: 40 },
      { id: 'other', label: 'other', sharePercent: 20 },
    ],
    execution: 'none',
  }
}

export function buildScheduleOptimizer(): ScheduleOptimizerContract {
  return {
    kind: 'schedule_optimizer',
    objectives: ['minimize_transfers', 'balance_pace'],
    conflicts: [],
    execution: 'none',
  }
}

export function buildTransportationPlanner(): TransportationPlannerContract {
  return {
    kind: 'transportation_planner',
    legs: [],
    execution: 'none',
  }
}

export function buildAccommodationPlanner(): AccommodationPlannerContract {
  return {
    kind: 'accommodation_planner',
    stays: [],
    execution: 'none',
  }
}

export function buildActivityPlanner(): ActivityPlannerContract {
  return {
    kind: 'activity_planner',
    activities: [],
    execution: 'none',
  }
}

export function buildRiskAnalyzer(): RiskAnalyzerContract {
  return {
    kind: 'risk_analyzer',
    risks: [],
    execution: 'none',
  }
}

export function buildConstraintEngine(): ConstraintEngineContract {
  return {
    kind: 'constraint_engine',
    hard: [],
    soft: [],
    execution: 'none',
  }
}

export function buildPreferenceMatcher(): PreferenceMatcherContract {
  return {
    kind: 'preference_matcher',
    matched: [],
    unmatched: [],
    execution: 'none',
  }
}

export function buildAlternativeGenerator(): AlternativeGeneratorContract {
  return {
    kind: 'alternative_generator',
    alternatives: [],
    execution: 'none',
  }
}

export function buildScenarioBuilder(): ScenarioBuilderContract {
  return {
    kind: 'scenario_builder',
    scenarios: [],
    execution: 'none',
  }
}

export function buildPlanningContext(
  sessionId: string,
  locale: PlanningLocale = 'ar',
): PlanningContextContract {
  return {
    kind: 'planning_context',
    sessionId,
    locale,
    destinationHints: [],
    dateHints: [],
    budgetHints: [],
    preferenceHints: [],
    moduleHints: PLANNING_MODULE_HINTS,
  }
}

export function buildPlanningSession(
  sessionId: string,
  locale: PlanningLocale = 'ar',
): PlanningSessionContract {
  return {
    kind: 'planning_session',
    sessionId,
    locale,
    openedAtIso: ISO,
    stateId: 'idle',
  }
}

export function buildPlanningStateMachine(): PlanningStateMachineContract {
  return {
    kind: 'planning_state_machine',
    current: 'idle',
    allowed: PLANNING_STATE_IDS,
    lastTransition: null,
    execution: 'none',
  }
}

export function buildPlanningConfidenceModel(
  score = 0.5,
): PlanningConfidenceModelContract {
  const band = score >= 0.75 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  return {
    kind: 'planning_confidence_model',
    score,
    band,
    factors: ['architecture_placeholder'],
    execution: 'none',
  }
}

export function buildPlanningEvent(
  sessionId: string,
  eventKind: PlanningEventContract['eventKind'],
  payloadSummary: string,
): PlanningEventContract {
  return {
    kind: 'planning_event',
    eventId: `pevt-${eventKind}`,
    eventKind,
    sessionId,
    atIso: ISO,
    payloadSummary,
  }
}

export function buildPlanningAnalytics(
  sessionId: string,
): PlanningAnalyticsContract {
  return {
    kind: 'planning_analytics',
    sessionId,
    stageCount: PLANNING_PIPELINE_STAGES.length,
    alternativeCount: 0,
    averageConfidence: 0,
    exported: false,
  }
}
