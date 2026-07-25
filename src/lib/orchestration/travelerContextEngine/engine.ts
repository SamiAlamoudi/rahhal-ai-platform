/**
 * Traveler Context Engine facade — builds architecture blueprints only.
 * Never assembles live context, calls LLMs, or reads Memory stores.
 */

import { listContextRegistry } from './registry'
import { isBrainContextEngineEnabled } from './registry'
import {
  buildAccommodationContext,
  buildActivityContext,
  buildBudgetContext,
  buildCompanionContext,
  buildConstraintContext,
  buildContextConfidenceContract,
  buildContextEngine,
  buildContextFreshness,
  buildContextMergeRules,
  buildContextPriorities,
  buildContextSnapshot,
  buildContextValidationContract,
  buildConversationContext,
  buildConversationContextContract,
  buildConversationSnapshot,
  buildCurrentGoalContext,
  buildCurrentTripContext,
  buildDestinationContext,
  buildEnvironmentContext,
  buildSessionContext,
  buildSessionContextContract,
  buildTimelineContext,
  buildTransportationContext,
  buildTravelContext,
  buildTravelerContext,
  buildTravelerState,
  buildTripContext,
  buildVisaContext,
  buildWeatherContext,
} from './pipelines'
import type {
  ContextLocale,
  TravelerContextEngineBlueprint,
} from './types'
import { TRAVELER_CONTEXT_ISOLATION } from './types'

export interface BuildTravelerContextBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: ContextLocale
}

export function buildTravelerContextEngineBlueprint(
  options: BuildTravelerContextBlueprintOptions = {},
): TravelerContextEngineBlueprint {
  const sessionId = options.sessionId ?? 'context-session-architecture'
  const locale = options.locale ?? 'ar'
  const conversationId = `conv-${sessionId}`

  const traveler = buildTravelerContext()
  const conversation = buildConversationContext(conversationId)
  const trip = buildTripContext()
  const session = buildSessionContext(sessionId, locale)
  const snapshot = buildContextSnapshot()
  const confidenceContract = buildContextConfidenceContract()
  const validationContract = buildContextValidationContract()

  return {
    version: '7.5.0-traveler-context',
    featureId: 'brain.context_engine',
    architectureOnly: true,
    engine: buildContextEngine(),
    conversationContext: buildConversationContextContract(conversationId),
    travelContext: buildTravelContext(),
    currentTripContext: buildCurrentTripContext(),
    travelerState: buildTravelerState(),
    sessionContext: buildSessionContextContract(sessionId, locale),
    environmentContext: buildEnvironmentContext(),
    constraintContext: buildConstraintContext(),
    budgetContext: buildBudgetContext(),
    destinationContext: buildDestinationContext(),
    timelineContext: buildTimelineContext(),
    companionContext: buildCompanionContext(),
    weatherContext: buildWeatherContext(),
    transportationContext: buildTransportationContext(),
    accommodationContext: buildAccommodationContext(),
    activityContext: buildActivityContext(),
    visaContext: buildVisaContext(),
    currentGoalContext: buildCurrentGoalContext(),
    conversationSnapshot: buildConversationSnapshot(),
    contextConfidence: confidenceContract,
    contextFreshness: buildContextFreshness(),
    contextMergeRules: buildContextMergeRules(),
    contextPriorities: buildContextPriorities(),
    contextValidation: validationContract,
    travelerContext: traveler,
    conversation,
    trip,
    session,
    snapshot,
    confidence: confidenceContract.confidence,
    validation: validationContract.validation,
    registry: listContextRegistry(),
  }
}

export function tryBuildTravelerContextEngineBlueprint(
  options: BuildTravelerContextBlueprintOptions = {},
): TravelerContextEngineBlueprint | null {
  if (!isBrainContextEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildTravelerContextEngineBlueprint(options)
}

export function assertTravelerContextIsolation(): typeof TRAVELER_CONTEXT_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...TRAVELER_CONTEXT_ISOLATION,
    architectureOnly: true,
    registrySize: listContextRegistry().length,
  }
}

export const TravelerContextEngine = {
  buildBlueprint: buildTravelerContextEngineBlueprint,
  tryBuildBlueprint: tryBuildTravelerContextEngineBlueprint,
  assertIsolation: assertTravelerContextIsolation,
}
