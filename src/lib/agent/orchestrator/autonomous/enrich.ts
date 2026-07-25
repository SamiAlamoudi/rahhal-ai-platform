/**
 * Phase 6 — Soft enrich for planTurn (flag-gated).
 */

import type { AgentMemory, TripRequirements } from '../../types'
import { missingRequirementFields } from '../../memory'
import { filterInterviewMissingFields } from '../../conversationIntelligence'
import { isAutonomousAgentOrchestratorEnabled } from './feature'
import { runAutonomousAgentOrchestrator } from './agentOrchestrator'
import type { AutonomousOrchestratorResult, MissionLocale } from './types'

function mergeRequirementsFromMission(
  requirements: TripRequirements,
  result: AutonomousOrchestratorResult,
): TripRequirements {
  const g = result.mission.goal
  return {
    ...requirements,
    destination: requirements.destination ?? g.destination,
    destinations:
      requirements.destinations.length > 0
        ? requirements.destinations
        : g.destination
          ? [g.destination]
          : requirements.destinations,
    budgetAmount: requirements.budgetAmount ?? g.budgetAmount,
    budgetCurrency: requirements.budgetCurrency ?? g.currency,
    durationDays: requirements.durationDays ?? g.durationDays,
    travelers: requirements.travelers ?? g.travelers,
    tripPurpose:
      requirements.tripPurpose
      ?? (g.purpose === 'honeymoon'
        || g.purpose === 'business'
        || g.purpose === 'family'
        || g.purpose === 'leisure'
        ? g.purpose
        : null),
  }
}

export function enrichWithAutonomousAgentOrchestrator(input: {
  userText: string
  memory: AgentMemory
  recentTexts?: string[]
  enabled?: boolean
  locale?: MissionLocale
}): {
  memory: AgentMemory
  autonomousOrchestrator: AutonomousOrchestratorResult | null
} {
  if (!isAutonomousAgentOrchestratorEnabled({ enabled: input.enabled })) {
    return { memory: input.memory, autonomousOrchestrator: null }
  }

  const locale = input.locale ?? input.memory.locale ?? 'ar'
  const result = runAutonomousAgentOrchestrator({
    userText: input.userText,
    locale,
    recentTexts: input.recentTexts,
  })

  const requirements = mergeRequirementsFromMission(input.memory.requirements, result)
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
    autonomousOrchestrator: result,
  }
}
