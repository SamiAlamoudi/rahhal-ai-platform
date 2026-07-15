import type { AgentIntent, RegenerateScope, TripRequirements } from '../types'
import type { AgentToolName } from './types'

/**
 * Decide which tools the agent should call for the current turn.
 * No guessing of missing requirements — tools only run when planning is ready.
 * Regeneration scopes narrow the tool set (flight / hotel / activities / day).
 */
export function selectToolsForTurn(input: {
  requirements: TripRequirements
  intent: AgentIntent
  missingFields: Array<keyof TripRequirements>
}): AgentToolName[] {
  const { requirements, intent, missingFields } = input
  if (missingFields.length > 0) return []
  if (intent === 'save') return []
  if (intent === 'edit' && !requirements.destination && requirements.destinations.length === 0) {
    return []
  }

  const scope = resolveScope(intent, requirements.regenerateScope)

  if (intent === 'regenerate_day' || scope === 'day') {
    return ['weather', 'attractions']
  }

  const planning = intent === 'plan'
    || intent === 'regenerate'
    || intent === 'answer'
    || intent === 'edit'
  if (!planning) return []

  const destination = requirements.destination || requirements.destinations[0]
  if (!destination) return []

  if (scope === 'flight') return ['flights']
  if (scope === 'hotel') return ['hotels']
  if (scope === 'activities') return ['weather', 'attractions', 'maps']

  const flightsOnly = requirements.packageScope === 'flights_only'
  const selected: AgentToolName[] = flightsOnly
    ? ['weather', 'flights', 'maps']
    : ['weather', 'attractions', 'maps', 'flights', 'hotels', 'transportation']

  if (requirements.budgetAmount != null || requirements.budgetCurrency || requirements.budgetFlexible) {
    selected.push('currency')
  }

  if (isLikelyInternational(destination)) {
    selected.push('visa')
  }

  return unique(selected)
}

function resolveScope(
  intent: AgentIntent,
  scope: RegenerateScope | null | undefined,
): RegenerateScope | null {
  if (intent === 'regenerate_day') return 'day'
  return scope ?? null
}

function isLikelyInternational(destination: string): boolean {
  const local = ['riyadh', 'jeddah', 'dammam', 'الرياض', 'جدة']
  const key = destination.trim().toLowerCase()
  return !local.some((city) => key.includes(city))
}

function unique(names: AgentToolName[]): AgentToolName[] {
  return [...new Set(names)]
}
