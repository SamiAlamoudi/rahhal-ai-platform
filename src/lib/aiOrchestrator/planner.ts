/**
 * Sprint 43 — lightweight Plan → Execute → Observe → Continue planner.
 * Determines tool sequence / parallel waves; does not own engine logic.
 */

import type { IntentRouteResult } from './intentRouter'
import type {
  OrchestratorMemorySnapshot,
  OrchestratorToolId,
  PlannerDecision,
  PlannerStage,
  ToolParallelGroup,
} from './types'

const STAGES: PlannerStage[] = ['plan', 'execute', 'observe', 'continue']

export function buildPlannerDecision(input: {
  route: IntentRouteResult
  memory: OrchestratorMemorySnapshot
}): PlannerDecision {
  const memoryHintsUsed = collectMemoryHints(input.memory)
  const missingSlots = detectMissingSlots(input.route, input.memory)
  const waves = buildWaves(input.route)

  return {
    intent: input.route.intent,
    stages: [...STAGES],
    waves,
    reason: input.route.reason,
    memoryHintsUsed,
    missingSlots,
  }
}

export function flattenTools(waves: ToolParallelGroup[]): OrchestratorToolId[] {
  const out: OrchestratorToolId[] = []
  for (const wave of waves) {
    for (const tool of wave.tools) {
      if (!out.includes(tool)) out.push(tool)
    }
  }
  return out
}

function buildWaves(route: IntentRouteResult): ToolParallelGroup[] {
  switch (route.intent) {
    case 'destination_travel':
      return [
        {
          parallel: true,
          tools: ['destination', 'flights', 'hotels', 'visa', 'insurance', 'activities'],
        },
      ]
    case 'cheapest_option':
      return [
        {
          parallel: true,
          tools: ['supplier_marketplace', 'loyalty', 'finance', 'refund_policy'],
        },
      ]
    case 'flight_cancelled':
      // Disruption first (needs recovery context), then parallel support tools.
      return [
        { parallel: false, tools: ['disruption'] },
        {
          parallel: true,
          tools: ['refund_policy', 'loyalty', 'timeline', 'supplier_marketplace'],
        },
      ]
    case 'lost_passport':
      return [
        { parallel: false, tools: ['travel_documents'] },
        { parallel: true, tools: ['visa', 'timeline', 'notifications'] },
      ]
    case 'general_plan':
      return [
        { parallel: false, tools: ['ai_conversation'] },
        { parallel: true, tools: ['flights', 'hotels', 'booking'] },
      ]
    case 'single_tool':
      return [{ parallel: false, tools: [...route.tools] }]
    case 'fallback':
    default:
      return [{ parallel: false, tools: ['ai_conversation'] }]
  }
}

function collectMemoryHints(memory: OrchestratorMemorySnapshot): string[] {
  const hints: string[] = []
  if (memory.budget.amount != null) hints.push('budget')
  if (memory.travellers.adults != null) hints.push('travellers')
  if (memory.passport.nationality || memory.nationality) hints.push('nationality')
  if (memory.passport.passportCountry) hints.push('passport')
  if (memory.preferredAirlines.length) hints.push('preferredAirlines')
  if (memory.hotelPreferences.length) hints.push('hotelPreferences')
  if (memory.seatPreferences.length) hints.push('seatPreferences')
  if (memory.loyaltyMemberships.length) hints.push('loyaltyMemberships')
  if (memory.destination) hints.push('destination')
  if (memory.origin) hints.push('origin')
  return hints
}

function detectMissingSlots(
  route: IntentRouteResult,
  memory: OrchestratorMemorySnapshot,
): string[] {
  const missing: string[] = []
  if (route.intent === 'destination_travel' && !memory.destination) {
    // Destination may still be in the utterance; planner marks soft miss only.
    missing.push('destination')
  }
  if (
    (route.intent === 'destination_travel' || route.intent === 'lost_passport')
    && !memory.nationality
    && !memory.passport.nationality
  ) {
    missing.push('nationality')
  }
  return missing
}
