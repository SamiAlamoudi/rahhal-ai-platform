import { getBookingHistoryUserId } from '../../../booking'
import { shouldRunBookingExecution } from '../../bookingExecution'
import { shouldRunPayments, shouldShowPaymentSummary } from '../../paymentsPlatform'
import { extractFromUserText } from '../../extractRequirements'
import {
  mergeRequirements,
  missingRequirementFields,
  rebuildMemoryFromMessages,
} from '../../memory'
import { withTripPlan, type AgentMemory } from '../../types'
import type { TravelAgentTurnInput } from '../../travelAgentService'
import type { PlanTurnContext, PlanTurnDeps } from '../context'
import { priorAutonomousFromMessages } from '../helpers'

export function initMemory(
  input: TravelAgentTurnInput,
  deps: PlanTurnDeps,
): PlanTurnContext {
  const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
  const userText = lastUser?.content ?? ''
  // Alpha — booking / payment / confirmation cues must reach Execution + Payments.
  const alphaBookingCue = shouldRunBookingExecution({
    userText,
    bookingReady: true,
  })
  const alphaPaymentCue = shouldRunPayments({ userText })
  const alphaSummaryCue = shouldShowPaymentSummary(userText)
  const alphaJourneyCue = alphaBookingCue || alphaPaymentCue || alphaSummaryCue
  const prior = rebuildMemoryFromMessages(input.messages.slice(0, -1))
  let extracted = extractFromUserText(userText, prior.locale)
  const preferenceUserId = getBookingHistoryUserId() || input.conversationId

  let memory: AgentMemory = {
    ...prior,
    locale: extracted.locale || prior.locale,
    lastIntent: extracted.intent,
    requirements: mergeRequirements(prior.requirements, extracted.patch, {
      replaceDestinations: extracted.flags?.replaceDestinations,
    }),
  }
  memory.missingFields = missingRequirementFields(memory.requirements)

  // Alpha — confirm/pay turns must keep prior trip context even if the last
  // user line has no destination text (CTAs like "أكد الحجز" / "ادفع الآن").
  if (alphaJourneyCue && memory.missingFields.length > 0) {
    for (const message of input.messages.slice(0, -1)) {
      if (message.role !== 'user') continue
      const priorExtract = extractFromUserText(message.content, memory.locale)
      memory = {
        ...memory,
        requirements: mergeRequirements(memory.requirements, priorExtract.patch),
      }
    }
    memory.missingFields = missingRequirementFields(memory.requirements)
    if (!memory.tripPlan && prior.tripPlan) {
      memory = withTripPlan(memory, prior.tripPlan)
    }
  }

  const autonomousSnapshot = deps.isAutonomousEnabled()
    ? priorAutonomousFromMessages(input.messages.slice(0, -1))
    : null

  return {
    input,
    userText,
    alphaJourneyCue,
    preferenceUserId,
    extracted,
    memory,
    reasoningResult: null,
    reasoningMeta: undefined,
    clarificationMeta: undefined,
    rahhalBrainMeta: undefined,
    travelExecutiveSnapshot: undefined,
    executivePlatformSnapshot: undefined,
    liveIntelligenceSnapshot: undefined,
    autonomousSnapshot,
    priorAutonomous: autonomousSnapshot,
    bookingIntelligenceResult: null,
    budgetIntelligenceResult: null,
    travelerPersonalizationResult: null,
    tripOptimizerResult: null,
    travelPlannerResult: null,
    autonomousDecisionResult: null,
    adaptiveLearningResult: null,
    priceIntelligenceResult: null,
    dynamicPackagesResult: null,
    itineraryRefinementResult: null,
    bookingExecutionResult: null,
    paymentsResult: null,
    constitutionMeta: undefined,
    conciergeIntegration: null,
    alphaTravelerAssembly: null,
    bookingAssistantAssembly: null,
    brainMeta: undefined,
    travelEngineOn: false,
    tripPlanningOn: false,
    executionOn: false,
    searchOn: false,
    orchestratorOn: false,
    conciergeState: null,
    toolBatch: null,
    objective: 'general',
    savedTitle: null,
  }
}
