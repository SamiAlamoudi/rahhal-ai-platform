/**
 * Step 3 — Planning Engine.
 * Builds an internal module plan before responding (never shown to the user).
 */

import type { AgentMemory } from '../../agent/types'
import type {
  BrainIntentResult,
  BrainModuleId,
  ConversationUnderstanding,
  InternalPlan,
  InternalPlanStep,
} from './types'

export function buildInternalPlan(input: {
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  memory: AgentMemory
  reasoningRan: boolean
}): InternalPlan {
  const steps: InternalPlanStep[] = []
  const modules = new Set<BrainModuleId>()

  const add = (id: string, goal: string, module: BrainModuleId, satisfied: boolean) => {
    steps.push({ id, goal, module, satisfied })
    modules.add(module)
  }

  add('ctx', 'Understand travel context', 'memory', true)

  if (!input.memory.requirements.destination && !input.understanding.travelContext.discoveryMode) {
    add('dest', 'Resolve destination', 'destination_discovery', false)
  } else if (input.understanding.travelContext.discoveryMode) {
    add('discover', 'Rank discovery destinations', 'reasoning', input.reasoningRan)
    add('climate', 'Match climate preference', 'climate', input.reasoningRan)
    add('rank', 'Rank and explain options', 'ranking', input.reasoningRan)
  } else {
    add('dest_known', 'Destination locked', 'destination_discovery', true)
  }

  if (input.understanding.travelContext.climateHint) {
    add('climate_fit', 'Validate climate fit', 'climate', input.reasoningRan)
  }

  if (!input.memory.requirements.budgetAmount && input.memory.requirements.budgetFlexible !== true) {
    add('budget', 'Estimate budget fit', 'budget', false)
  } else {
    add('budget_ok', 'Budget context available', 'budget', true)
  }

  if (input.intents.primary.id === 'visa_inquiry'
    || input.intents.secondary.some((row) => row.id === 'visa_inquiry')
    || input.reasoningRan) {
    add('visa', 'Visa guidance', 'visa', input.reasoningRan)
    add('advisory', 'Travel advisory', 'advisory', input.reasoningRan)
  }

  if (input.intents.primary.id === 'flight_search'
    || input.memory.requirements.packageScope === 'flights_only') {
    add('flights', 'Flight options', 'flights', false)
  }

  if (input.intents.primary.id === 'hotel_search'
    || input.memory.requirements.packageScope === 'full_package') {
    add('hotels', 'Hotel options', 'hotels', false)
  }

  if (input.intents.primary.id === 'trip_planning'
    || input.memory.requirements.destination) {
    add('plan', 'Build itinerary plan', 'planning', Boolean(input.memory.tripPlan))
  }

  add('prefs', 'Apply traveler preferences', 'preferences', true)
  add('clarify', 'Infer soft preferences', 'clarification', true)

  if (input.understanding.constraints.includes('avoid_long_flights')) {
    add('safety', 'Apply flight-duration constraint', 'safety', input.reasoningRan)
  }

  return {
    steps,
    modulesToRun: [...modules],
  }
}
