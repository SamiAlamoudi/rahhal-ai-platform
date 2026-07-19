import type {
  BrainMemorySlot,
  BrainResponsePlan,
  BookingRequestHint,
  ConversationContext,
  IntentClassification,
  RecommendationHint,
  TravelPlan,
} from './types'
import { buildContextualFollowUp, promptForField } from './contextualReply'
import { nextFieldToAsk } from './missingInformationDetector'
import { buildTravelPlan } from './travelPlanBuilder'
import type { TravelPlanSketch } from './travelPlanner'

/**
 * ResponsePlanner — structured plan only (no LLM generation / no fake prose replies).
 * Sprint 21 optionally attaches TravelPlan + one contextual follow-up.
 */
export function ResponsePlanner(input: {
  context: ConversationContext
  classification: IntentClassification
  missingFields: BrainMemorySlot[]
  travelPlan: TravelPlanSketch
  /** Sprint 21 — enable TravelPlan + contextual reply. */
  travelEngine?: boolean
}): BrainResponsePlan {
  const locale = input.context.locale
  const intent = input.classification.intent
  const ask = nextFieldToAsk(input.missingFields)

  const bookingRequests: BookingRequestHint[] = []
  if (input.travelPlan.action === 'continue_booking') {
    bookingRequests.push({ kind: 'continue', reason: null })
  } else if (input.travelPlan.action === 'modify_trip') {
    bookingRequests.push({ kind: 'modify', reason: null })
  } else if (input.travelPlan.action === 'cancel_booking') {
    bookingRequests.push({ kind: 'cancel', reason: null })
  }

  const recommendations: RecommendationHint[] = []
  if (input.travelPlan.action === 'recommend' && input.context.memory.destination) {
    recommendations.push({
      topic: input.context.memory.destination,
      reason: 'destination_known',
    })
  }

  const suggestedReplies: string[] = []
  let contextualReply: string | null = null
  if (ask) {
    const prompt = promptForField(ask, locale)
    suggestedReplies.push(prompt)
    if (input.travelEngine) {
      contextualReply = buildContextualFollowUp({
        memory: input.context.memory,
        missingFields: input.missingFields,
        locale,
      })
      if (contextualReply && contextualReply !== prompt) {
        suggestedReplies[0] = contextualReply
      }
    }
  }

  const summary =
    ask != null
      ? `need_slot:${ask}`
      : `ready:${input.travelPlan.action}`

  const assistantGoal =
    ask != null
      ? `collect:${ask}`
      : `execute:${input.travelPlan.action}`

  const planWithoutTravel: Omit<BrainResponsePlan, 'travelPlan'> = {
    summary,
    assistantGoal,
    missingFields: input.missingFields,
    action: input.travelPlan.action,
    uiHints: {
      showMemoryPanel: true,
      showIntentChip: true,
      highlightMissing: input.missingFields.slice(0, 3),
      suggestedReplies,
      contextualReply,
    },
    searchRequests: input.travelPlan.searchRequests,
    bookingRequests,
    recommendations,
    intent,
    confidence: input.classification.confidence,
  }

  let travelPlan: TravelPlan | null = null
  if (input.travelEngine) {
    travelPlan = buildTravelPlan({
      memory: input.context.memory,
      plan: planWithoutTravel,
      locale,
    })
  }

  return {
    ...planWithoutTravel,
    travelPlan,
  }
}
