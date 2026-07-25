/**
 * Traveler Context Engine contracts — pure builders, no live context assembly.
 */

import type {
  AccommodationContextContract,
  ActivityContextContract,
  BudgetContextContract,
  CompanionContextContract,
  ConstraintContextContract,
  ContextConfidenceContract,
  ContextEngineContract,
  ContextFreshnessContract,
  ContextLocale,
  ContextMergeRulesContract,
  ContextPrioritiesContract,
  ContextSnapshot,
  ContextValidationContract,
  ConversationContext,
  ConversationContextContract,
  ConversationSnapshotContract,
  CurrentGoalContextContract,
  CurrentTripContextContract,
  DestinationContextContract,
  EnvironmentContextContract,
  SessionContext,
  SessionContextContract,
  TimelineContextContract,
  TransportationContextContract,
  TravelContextContract,
  TravelerContext,
  TravelerStateContract,
  TripContext,
  VisaContextContract,
  WeatherContextContract,
} from './types'
import { CONTEXT_SECTION_IDS } from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildContextEngine(): ContextEngineContract {
  return {
    kind: 'context_engine',
    version: '7.5.0-traveler-context',
    execution: 'none',
    distinctFromMemory: true,
  }
}

export function buildTravelerContext(): TravelerContext {
  return {
    kind: 'traveler_context',
    travelerIdHint: 'traveler-architecture',
    stateHints: [],
    execution: 'none',
  }
}

export function buildConversationContext(
  conversationId: string,
): ConversationContext {
  return {
    kind: 'conversation_context',
    conversationId,
    intentHint: null,
    goalHints: [],
    execution: 'none',
  }
}

export function buildTripContext(): TripContext {
  return {
    kind: 'trip_context',
    tripIdHint: null,
    destinationHints: [],
    execution: 'none',
  }
}

export function buildSessionContext(
  sessionId: string,
  locale: ContextLocale = 'ar',
): SessionContext {
  return {
    kind: 'session_context',
    sessionId,
    locale,
    execution: 'none',
  }
}

export function buildContextSnapshot(): ContextSnapshot {
  return {
    kind: 'context_snapshot',
    snapshotId: 'csnap-architecture',
    atIso: ISO,
    sectionHints: CONTEXT_SECTION_IDS,
    execution: 'none',
  }
}

export function buildConversationContextContract(
  conversationId: string,
): ConversationContextContract {
  return {
    kind: 'conversation_context_contract',
    conversation: buildConversationContext(conversationId),
    execution: 'none',
  }
}

export function buildTravelContext(): TravelContextContract {
  return {
    kind: 'travel_context',
    facets: [
      'current_trip',
      'destination',
      'transportation',
      'accommodation',
      'activity',
      'visa',
    ],
    execution: 'none',
  }
}

export function buildCurrentTripContext(): CurrentTripContextContract {
  return {
    kind: 'current_trip_context',
    trip: buildTripContext(),
    execution: 'none',
  }
}

export function buildTravelerState(): TravelerStateContract {
  return {
    kind: 'traveler_state',
    traveler: buildTravelerContext(),
    execution: 'none',
  }
}

export function buildSessionContextContract(
  sessionId: string,
  locale: ContextLocale = 'ar',
): SessionContextContract {
  return {
    kind: 'session_context_contract',
    session: buildSessionContext(sessionId, locale),
    execution: 'none',
  }
}

export function buildEnvironmentContext(): EnvironmentContextContract {
  return {
    kind: 'environment_context',
    timeHint: 'unspecified',
    locationHint: null,
    execution: 'none',
  }
}

export function buildConstraintContext(): ConstraintContextContract {
  return {
    kind: 'constraint_context',
    constraintHints: [],
    execution: 'none',
  }
}

export function buildBudgetContext(): BudgetContextContract {
  return {
    kind: 'budget_context',
    currencyHint: 'SAR',
    amountHint: null,
    execution: 'none',
  }
}

export function buildDestinationContext(): DestinationContextContract {
  return {
    kind: 'destination_context',
    destinationHints: [],
    execution: 'none',
  }
}

export function buildTimelineContext(): TimelineContextContract {
  return {
    kind: 'timeline_context',
    dateHints: [],
    execution: 'none',
  }
}

export function buildCompanionContext(): CompanionContextContract {
  return {
    kind: 'companion_context',
    companionHints: [],
    execution: 'none',
  }
}

export function buildWeatherContext(): WeatherContextContract {
  return {
    kind: 'weather_context',
    weatherHints: [],
    execution: 'none',
  }
}

export function buildTransportationContext(): TransportationContextContract {
  return {
    kind: 'transportation_context',
    modeHints: [],
    execution: 'none',
  }
}

export function buildAccommodationContext(): AccommodationContextContract {
  return {
    kind: 'accommodation_context',
    lodgingHints: [],
    execution: 'none',
  }
}

export function buildActivityContext(): ActivityContextContract {
  return {
    kind: 'activity_context',
    activityHints: [],
    execution: 'none',
  }
}

export function buildVisaContext(): VisaContextContract {
  return {
    kind: 'visa_context',
    documentHints: [],
    execution: 'none',
  }
}

export function buildCurrentGoalContext(): CurrentGoalContextContract {
  return {
    kind: 'current_goal_context',
    goalHints: [],
    execution: 'none',
  }
}

export function buildConversationSnapshot(): ConversationSnapshotContract {
  return {
    kind: 'conversation_snapshot',
    snapshot: buildContextSnapshot(),
    execution: 'none',
  }
}

export function buildContextConfidenceContract(): ContextConfidenceContract {
  return {
    kind: 'context_confidence_contract',
    confidence: {
      kind: 'context_confidence',
      scoreHint: 0,
      bandHint: 'medium',
      execution: 'none',
    },
    execution: 'none',
  }
}

export function buildContextFreshness(): ContextFreshnessContract {
  return {
    kind: 'context_freshness',
    freshnessBandHint: 'unknown',
    execution: 'none',
  }
}

export function buildContextMergeRules(): ContextMergeRulesContract {
  return {
    kind: 'context_merge_rules',
    ruleHints: [
      'prefer_session_over_stale',
      'prefer_explicit_constraints',
      'deny_memory_as_live_context',
    ],
    execution: 'none',
  }
}

export function buildContextPriorities(): ContextPrioritiesContract {
  return {
    kind: 'context_priorities',
    priorityHints: [
      'current_intent',
      'current_goals',
      'constraints',
      'budget',
      'trip',
      'preferences',
      'environment',
    ],
    execution: 'none',
  }
}

export function buildContextValidationContract(): ContextValidationContract {
  return {
    kind: 'context_validation_contract',
    validation: {
      kind: 'context_validation',
      valid: true,
      issues: [],
      execution: 'none',
    },
    execution: 'none',
  }
}
