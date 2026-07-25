/**
 * Intent Recognition Engine facade — builds architecture blueprints only.
 * Never classifies utterances, calls LLMs, or starts planning/booking.
 */

import {
  listIntentKindRegistry,
  listIntentSectionRegistry,
} from './registry'
import { isBrainIntentEngineEnabled } from './registry'
import {
  buildBookingIntent,
  buildConversationIntent,
  buildIntentClassifier,
  buildIntentConfidenceContract,
  buildIntentEngine,
  buildIntentHistory,
  buildIntentPredictionSample,
  buildIntentPriorityRules,
  buildIntentRegistryContract,
  buildIntentResolutionRules,
  buildIntentSchema,
  buildIntentSnapshot,
  buildIntentTransitionModel,
  buildIntentValidationContract,
  buildMultiIntent,
  buildSupportIntent,
  buildTravelIntent,
  buildTravelerIntentSample,
} from './pipelines'
import type { IntentEngineBlueprint, IntentLocale } from './types'
import { INTENT_ENGINE_ISOLATION } from './types'

export interface BuildIntentEngineBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: IntentLocale
}

export function buildIntentEngineBlueprint(
  options: BuildIntentEngineBlueprintOptions = {},
): IntentEngineBlueprint {
  void options.sessionId
  void options.locale

  const confidence = buildIntentConfidenceContract()
  const validation = buildIntentValidationContract()
  const multiIntent = buildMultiIntent()
  const transitionModel = buildIntentTransitionModel()

  return {
    version: '7.6.0-intent-engine',
    featureId: 'brain.intent_engine',
    architectureOnly: true,
    engine: buildIntentEngine(),
    registry: buildIntentRegistryContract(),
    classifier: buildIntentClassifier(),
    schema: buildIntentSchema(),
    confidence,
    validation,
    priorityRules: buildIntentPriorityRules(),
    resolutionRules: buildIntentResolutionRules(),
    transitionModel,
    conversationIntent: buildConversationIntent(),
    travelIntent: buildTravelIntent(),
    bookingIntent: buildBookingIntent(),
    supportIntent: buildSupportIntent(),
    multiIntent,
    history: buildIntentHistory(),
    snapshot: buildIntentSnapshot(),
    travelerIntent: buildTravelerIntentSample(),
    intentPrediction: buildIntentPredictionSample(),
    intentConfidence: confidence.confidence,
    intentTransition: transitionModel.allowedTransitions[0]!,
    intentValidation: validation.validation,
    multiIntentResult: multiIntent.result,
    sectionRegistry: listIntentSectionRegistry(),
  }
}

export function tryBuildIntentEngineBlueprint(
  options: BuildIntentEngineBlueprintOptions = {},
): IntentEngineBlueprint | null {
  if (!isBrainIntentEngineEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildIntentEngineBlueprint(options)
}

export function assertIntentEngineIsolation(): typeof INTENT_ENGINE_ISOLATION & {
  architectureOnly: boolean
  kindCount: number
  sectionCount: number
} {
  return {
    ...INTENT_ENGINE_ISOLATION,
    architectureOnly: true,
    kindCount: listIntentKindRegistry().length,
    sectionCount: listIntentSectionRegistry().length,
  }
}

export const IntentEngine = {
  buildBlueprint: buildIntentEngineBlueprint,
  tryBuildBlueprint: tryBuildIntentEngineBlueprint,
  assertIsolation: assertIntentEngineIsolation,
}
