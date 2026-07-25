/**
 * Phase 4 — Soft enrich for planTurn (flag-gated).
 *
 * Does not replace extractFromUserText or chatEngine ownership.
 * When OFF → null and unchanged memory.
 */

import { missingRequirementFields } from '../memory'
import type { AgentMemory, TripRequirements } from '../types'
import { analyzeConversation } from './analyze'
import { isConversationIntelligenceEnabled } from './feature'
import { filterInterviewMissingFields } from './questionPlanner'
import type {
  ConsultantLocale,
  ConversationIntelligenceResult,
  LiveTravelMemory,
} from './types'

function mergeRequirementsFromIntelligence(
  requirements: TripRequirements,
  result: ConversationIntelligenceResult,
): TripRequirements {
  const m = result.memory
  const travelers =
    requirements.travelers
    ?? (m.travelers.total != null && m.travelers.total > 0 ? m.travelers.total : null)
    ?? (m.travelers.adults != null ? m.travelers.adults : null)

  let travelerType = requirements.travelerType
  if (!travelerType && m.travelers.adults === 2 && (m.travelers.children ?? 0) === 0) {
    travelerType = 'couple'
  }
  if (!travelerType && (m.travelers.children ?? 0) > 0) travelerType = 'family'
  if (!travelerType && m.purpose === 'business') travelerType = 'business'

  const tripPurpose =
    requirements.tripPurpose
    ?? (m.purpose === 'business'
      || m.purpose === 'leisure'
      || m.purpose === 'family'
      || m.purpose === 'honeymoon'
      ? m.purpose
      : null)

  return {
    ...requirements,
    destination: requirements.destination ?? m.destination,
    destinations:
      requirements.destinations.length > 0
        ? requirements.destinations
        : m.cities.length > 0
          ? [...m.cities]
          : requirements.destinations,
    budgetAmount: requirements.budgetAmount ?? m.budgetAmount,
    budgetCurrency: requirements.budgetCurrency ?? m.currency,
    startDate: requirements.startDate ?? m.startDate,
    endDate: requirements.endDate ?? m.endDate,
    travelers,
    travelerType,
    hotelPreference:
      requirements.hotelPreference
      ?? (m.hotelPreferences[0] ?? null),
    weatherPreference: requirements.weatherPreference ?? m.weatherPreference,
    tripPurpose,
    interests:
      requirements.interests.length > 0
        ? requirements.interests
        : [...m.activities],
  }
}

export function enrichWithConversationIntelligence(input: {
  userText: string
  memory: AgentMemory
  priorLiveMemory?: LiveTravelMemory | null
  recentTexts?: string[]
  enabled?: boolean
  streaming?: boolean
  locale?: ConsultantLocale
}): {
  memory: AgentMemory
  conversationIntelligence: ConversationIntelligenceResult | null
} {
  if (!isConversationIntelligenceEnabled({ enabled: input.enabled })) {
    return { memory: input.memory, conversationIntelligence: null }
  }

  const locale = input.locale ?? input.memory.locale ?? 'ar'
  const result = analyzeConversation({
    userText: input.userText,
    priorMemory: input.priorLiveMemory ?? null,
    recentTexts: input.recentTexts,
    locale,
    streaming: input.streaming,
  })

  const requirements = mergeRequirementsFromIntelligence(input.memory.requirements, result)
  const missingFields = filterInterviewMissingFields(
    missingRequirementFields(requirements).map(String),
  ) as Array<keyof TripRequirements>

  return {
    memory: {
      ...input.memory,
      requirements,
      missingFields,
      locale,
    },
    conversationIntelligence: result,
  }
}
