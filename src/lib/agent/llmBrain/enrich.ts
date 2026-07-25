/**
 * Phase 5 — Soft enrich for planTurn (flag-gated).
 * Does not replace Conversation Brain reply authorship or search engines.
 */

import type { AgentMemory, TripRequirements } from '../types'
import { missingRequirementFields } from '../memory'
import { filterInterviewMissingFields } from '../conversationIntelligence'
import { isLlmConversationBrainEnabled } from './feature'
import { runLlmConversationBrain } from './llmConversationBrain'
import type { LlmBrainLocale, LlmBrainResult } from './types'

function mergeRequirementsFromBrain(
  requirements: TripRequirements,
  result: LlmBrainResult,
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

export function enrichWithLlmConversationBrain(input: {
  userText: string
  memory: AgentMemory
  recentTexts?: string[]
  enabled?: boolean
  locale?: LlmBrainLocale
  turn?: number
  forceRulesFallback?: boolean
}): {
  memory: AgentMemory
  llmBrain: LlmBrainResult | null
} {
  if (!isLlmConversationBrainEnabled({ enabled: input.enabled })) {
    return { memory: input.memory, llmBrain: null }
  }

  const locale = input.locale ?? input.memory.locale ?? 'ar'
  const result = runLlmConversationBrain({
    userText: input.userText,
    priorMemory: null,
    recentTexts: input.recentTexts,
    locale,
    turn: input.turn,
    forceRulesFallback: input.forceRulesFallback,
  })

  const requirements = mergeRequirementsFromBrain(input.memory.requirements, result)
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
    llmBrain: result,
  }
}
