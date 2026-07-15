import type { AgentIntent, TripRequirements } from '../types'
import type { AgentToolName } from './types'

/**
 * Decide which tools the agent should call for the current turn.
 * No guessing of missing requirements — tools only run when planning is ready.
 */
export function selectToolsForTurn(input: {
  requirements: TripRequirements
  intent: AgentIntent
  missingFields: Array<keyof TripRequirements>
}): AgentToolName[] {
  const { requirements, intent, missingFields } = input
  if (missingFields.length > 0) return []
  if (intent === 'save') return []
  if (intent === 'regenerate_day') return []
  if (intent === 'edit' && !requirements.destination && requirements.destinations.length === 0) {
    return []
  }

  const planning = intent === 'plan'
    || intent === 'regenerate'
    || intent === 'answer'
    || intent === 'edit'
  if (!planning) return []

  const destination = requirements.destination || requirements.destinations[0]
  if (!destination) return []

  const flightsOnly = requirements.packageScope === 'flights_only'
  const selected: AgentToolName[] = flightsOnly
    ? ['weather', 'flights', 'maps']
    : ['weather', 'attractions', 'maps', 'flights', 'hotels']

  if (requirements.budgetAmount != null || requirements.budgetCurrency || requirements.budgetFlexible) {
    selected.push('currency')
  }

  if (isLikelyInternational(destination)) {
    selected.push('visa')
  }

  return unique(selected)
}

function isLikelyInternational(destination: string): boolean {
  const local = ['riyadh', 'jeddah', 'dammam', 'الرياض', 'جدة']
  const key = destination.trim().toLowerCase()
  return !local.some((city) => key.includes(city))
}

function unique(names: AgentToolName[]): AgentToolName[] {
  return [...new Set(names)]
}
