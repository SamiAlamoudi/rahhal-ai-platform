/**
 * Phase 6 — Soft enrich for planTurn (flag-gated).
 */

import type { AgentMemory, TripRequirements } from '../types'
import { missingRequirementFields } from '../memory'
import { filterInterviewMissingFields } from '../conversationIntelligence'
import { runAgentRuntime } from './agentRuntime'
import { isAgentRuntimeEnabled } from './feature'
import type { AgentRuntimeResult, RuntimeLocale } from './types'

function mergeRequirementsFromRuntime(
  requirements: TripRequirements,
  result: AgentRuntimeResult,
): TripRequirements {
  const m = result.memory
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
    travelers:
      requirements.travelers
      ?? m.travelers.total
      ?? m.travelers.adults,
    hotelPreference: requirements.hotelPreference ?? m.hotelPreferences[0] ?? null,
    weatherPreference: requirements.weatherPreference ?? m.weatherPreference,
  }
}

export async function enrichWithAgentRuntime(input: {
  userText: string
  memory: AgentMemory
  recentTexts?: string[]
  enabled?: boolean
  locale?: RuntimeLocale
  conversationId?: string
}): Promise<{
  memory: AgentMemory
  agentRuntime: AgentRuntimeResult | null
}> {
  if (!isAgentRuntimeEnabled({ enabled: input.enabled })) {
    return { memory: input.memory, agentRuntime: null }
  }

  const locale = input.locale ?? input.memory.locale ?? 'ar'
  const result = await runAgentRuntime({
    userText: input.userText,
    locale,
    recentTexts: input.recentTexts,
    sessionId: input.conversationId ?? 'planTurn',
  })

  const requirements = mergeRequirementsFromRuntime(input.memory.requirements, result)
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
    agentRuntime: result,
  }
}
