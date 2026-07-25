/**
 * Intent engine contracts — pure builders, no classification or LLM.
 */

import type {
  BookingIntentContract,
  ConversationIntentContract,
  IntentClassifierContract,
  IntentConfidenceContract,
  IntentEngineContract,
  IntentHistoryContract,
  IntentPriorityRulesContract,
  IntentRegistryContract,
  IntentResolutionRulesContract,
  IntentSchemaContract,
  IntentSnapshotContract,
  IntentTransition,
  IntentTransitionModelContract,
  IntentValidationContract,
  MultiIntentContract,
  SupportIntentContract,
  TravelIntentContract,
  TravelerIntent,
  IntentPrediction,
  IntentConfidence,
  IntentValidation,
  MultiIntentResult,
} from './types'
import { INTENT_DOMAINS, INTENT_KINDS } from './types'
import { listIntentKindRegistry } from './registry'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildIntentEngine(): IntentEngineContract {
  return {
    kind: 'intent_engine',
    version: '7.6.0-intent-engine',
    execution: 'none',
  }
}

export function buildIntentRegistryContract(): IntentRegistryContract {
  return {
    kind: 'intent_registry',
    entries: listIntentKindRegistry(),
    execution: 'none',
  }
}

export function buildIntentClassifier(): IntentClassifierContract {
  return {
    kind: 'intent_classifier',
    classifierHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildIntentSchema(): IntentSchemaContract {
  return {
    kind: 'intent_schema',
    intentKinds: INTENT_KINDS,
    domains: INTENT_DOMAINS,
    execution: 'none',
  }
}

export function buildIntentConfidenceContract(): IntentConfidenceContract {
  const confidence: IntentConfidence = {
    kind: 'intent_confidence',
    intentId: 'intent-architecture',
    scoreHint: 0,
    bandHint: 'medium',
    execution: 'none',
  }
  return {
    kind: 'intent_confidence_contract',
    confidence,
    execution: 'none',
  }
}

export function buildIntentValidationContract(): IntentValidationContract {
  const validation: IntentValidation = {
    kind: 'intent_validation',
    intentId: 'intent-architecture',
    valid: true,
    issues: [],
    execution: 'none',
  }
  return {
    kind: 'intent_validation_contract',
    validation,
    execution: 'none',
  }
}

export function buildIntentPriorityRules(): IntentPriorityRulesContract {
  return {
    kind: 'intent_priority_rules',
    ruleHints: [
      'prefer_emergency_support',
      'prefer_booking_over_general',
      'prefer_explicit_over_implicit',
    ],
    execution: 'none',
  }
}

export function buildIntentResolutionRules(): IntentResolutionRulesContract {
  return {
    kind: 'intent_resolution_rules',
    ruleHints: [
      'resolve_primary_by_confidence',
      'keep_secondary_as_multi_intent',
      'deny_unvalidated',
    ],
    execution: 'none',
  }
}

export function buildIntentTransitionModel(): IntentTransitionModelContract {
  const allowedTransitions: IntentTransition[] = [
    {
      kind: 'intent_transition',
      fromIntent: 'general_conversation',
      toIntent: 'plan_trip',
      reasonHint: 'architecture_placeholder',
      execution: 'none',
    },
    {
      kind: 'intent_transition',
      fromIntent: 'plan_trip',
      toIntent: 'book_flight',
      reasonHint: 'architecture_placeholder',
      execution: 'none',
    },
    {
      kind: 'intent_transition',
      fromIntent: 'plan_trip',
      toIntent: 'book_hotel',
      reasonHint: 'architecture_placeholder',
      execution: 'none',
    },
    {
      kind: 'intent_transition',
      fromIntent: null,
      toIntent: 'intent_switching',
      reasonHint: 'switch_detected_hint',
      execution: 'none',
    },
  ]
  return {
    kind: 'intent_transition_model',
    allowedTransitions,
    execution: 'none',
  }
}

export function buildConversationIntent(): ConversationIntentContract {
  return {
    kind: 'conversation_intent',
    intentKinds: [
      'ask_question',
      'general_conversation',
      'multi_intent',
      'intent_switching',
    ],
    execution: 'none',
  }
}

export function buildTravelIntent(): TravelIntentContract {
  return {
    kind: 'travel_intent',
    intentKinds: [
      'plan_trip',
      'compare_destinations',
      'visa_inquiry',
      'budget_advice',
      'transportation',
      'restaurant_recommendation',
      'activity_search',
    ],
    execution: 'none',
  }
}

export function buildBookingIntent(): BookingIntentContract {
  return {
    kind: 'booking_intent',
    intentKinds: [
      'book_flight',
      'book_hotel',
      'modify_trip',
      'cancel_trip',
    ],
    execution: 'none',
  }
}

export function buildSupportIntent(): SupportIntentContract {
  return {
    kind: 'support_intent',
    intentKinds: ['emergency_support', 'customer_service'],
    execution: 'none',
  }
}

export function buildMultiIntent(): MultiIntentContract {
  const result: MultiIntentResult = {
    kind: 'multi_intent_result',
    resultId: 'multi-architecture',
    intents: [],
    primaryHint: null,
    execution: 'none',
  }
  return {
    kind: 'multi_intent',
    result,
    execution: 'none',
  }
}

export function buildIntentHistory(): IntentHistoryContract {
  return {
    kind: 'intent_history',
    entries: [
      {
        id: 'ihist-open',
        intentKind: 'general_conversation',
        atIso: ISO,
        summary: 'architecture blueprint',
      },
    ],
    persisted: false,
    execution: 'none',
  }
}

export function buildIntentSnapshot(): IntentSnapshotContract {
  return {
    kind: 'intent_snapshot',
    snapshotId: 'isnap-architecture',
    atIso: ISO,
    primaryIntent: null,
    predictions: [],
    execution: 'none',
  }
}

export function buildTravelerIntentSample(): TravelerIntent {
  return {
    kind: 'traveler_intent',
    intentId: 'intent-architecture',
    intentKind: 'general_conversation',
    domainHint: 'conversation',
    execution: 'none',
  }
}

export function buildIntentPredictionSample(): IntentPrediction {
  return {
    kind: 'intent_prediction',
    predictionId: 'ipred-architecture',
    intentKind: 'general_conversation',
    rankHint: 0,
    execution: 'none',
  }
}
