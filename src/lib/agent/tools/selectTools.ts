import type { AgentIntent, RegenerateScope, TripRequirements } from '../types'
import type { AgentToolName } from './types'
import type { SearchPlan, SearchToolHint } from '../travelPlanner/types'

/**
 * Decide which tools the agent should call for the current turn.
 * No guessing of missing requirements — tools only run when planning is ready.
 * Regeneration scopes narrow the tool set (flight / hotel / activities / day).
 *
 * Sprint 78 — optional Travel Planner searchPlan reorders / skips tools additively.
 */
export function selectToolsForTurn(input: {
  requirements: TripRequirements
  intent: AgentIntent
  missingFields: Array<keyof TripRequirements>
  /** Sprint 78 — additive search strategy from Travel Planner. */
  searchPlan?: SearchPlan | null
}): AgentToolName[] {
  const { requirements, intent, missingFields, searchPlan } = input

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
  let selected: AgentToolName[] = flightsOnly
    ? ['weather', 'flights', 'maps']
    : ['weather', 'attractions', 'maps', 'flights', 'hotels', 'transportation']

  if (requirements.budgetAmount != null || requirements.budgetCurrency || requirements.budgetFlexible) {
    selected.push('currency')
  }

  if (isLikelyInternational(destination)) {
    selected.push('visa')
  }

  selected = unique(selected)

  if (searchPlan) {
    selected = applySearchPlan(selected, searchPlan)
  }

  return selected
}

function applySearchPlan(selected: AgentToolName[], plan: SearchPlan): AgentToolName[] {
  const skip = new Set(plan.skipTools.map(hintToTool).filter(Boolean) as AgentToolName[])
  let next = selected.filter((name) => !skip.has(name))

  // Ensure planner-required tools are present when relevant.
  const ensure: AgentToolName[] = []
  if (plan.needWeather && selected.includes('weather')) ensure.push('weather')
  if (plan.needVisaCheck && !skip.has('visa')) ensure.push('visa')
  if (plan.needAirportTransfer) {
    if (selected.includes('transportation')) ensure.push('transportation')
    if (selected.includes('maps')) ensure.push('maps')
  }
  for (const name of ensure) {
    if (!next.includes(name) && selected.includes(name)) next.push(name)
  }

  // Reorder by recommendedSearchOrder while keeping any extras at the end.
  const order = plan.recommendedSearchOrder
    .map(hintToTool)
    .filter((name): name is AgentToolName => Boolean(name) && next.includes(name as AgentToolName))
  const ordered: AgentToolName[] = []
  for (const name of order) {
    if (!ordered.includes(name)) ordered.push(name)
  }
  for (const name of next) {
    if (!ordered.includes(name)) ordered.push(name)
  }
  return ordered
}

function hintToTool(hint: SearchToolHint): AgentToolName | null {
  switch (hint) {
    case 'flights':
    case 'hotels':
    case 'weather':
    case 'visa':
    case 'maps':
    case 'attractions':
    case 'transportation':
    case 'currency':
      return hint
    default:
      return null
  }
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
