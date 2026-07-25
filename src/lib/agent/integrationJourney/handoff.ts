/**
 * Integration Sprint 12 — shared handoff context + stage inference.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { detectTripScenario } from '../integrationTripOrchestrator/memory'
import type {
  JourneyHandoffContext,
  JourneyMemorySnapshot,
  JourneyScenario,
  JourneyStageId,
} from './types'
import { JOURNEY_STAGE_ORDER } from './types'

export function toJourneyScenario(label: string): JourneyScenario {
  switch (label) {
    case 'business':
    case 'family':
    case 'luxury':
    case 'weekend':
    case 'budget':
    case 'multi_city':
      return label
    default:
      return 'leisure'
  }
}

export function collectKnownSlots(memory: AgentMemory): string[] {
  const r = memory.requirements
  const known: string[] = []
  if (r.destination || r.destinations[0]) known.push('destination')
  if (r.origin) known.push('origin')
  if (r.startDate || r.datesFlexible) known.push('dates')
  if (r.durationDays) known.push('duration')
  if (typeof r.travelers === 'number' && r.travelers > 0) known.push('travelers')
  if (typeof r.budgetAmount === 'number') known.push('budget')
  if (r.budgetCurrency) known.push('currency')
  if (r.tripPurpose || r.travelerType) known.push('purpose')
  if (r.interests?.length) known.push('interests')
  if (memory.tripPlan) known.push('trip_plan')
  if (memory.tripPlan?.flights.length) known.push('flights')
  if (memory.tripPlan?.accommodations.length) known.push('hotels')
  return known
}

export function buildHandoffContext(input: {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  conversationId?: string | null
  journeyMemory?: JourneyMemorySnapshot | null
  stage: JourneyStageId
  scenario?: JourneyScenario
}): JourneyHandoffContext {
  const plan = input.tripPlan ?? input.memory.tripPlan
  const r = input.memory.requirements
  const known = unique([
    ...collectKnownSlots(input.memory),
    ...(input.journeyMemory?.knownSlots ?? []),
  ])
  const missing = (input.memory.missingFields ?? [])
    .map(String)
    .filter((m) => !known.includes(m))
  const scenario = input.scenario
    ?? toJourneyScenario(detectTripScenario(r))
  const travelerState = inferTravelerState(input.stage, plan)

  return {
    conversationId: input.conversationId ?? null,
    locale: input.locale ?? input.memory.locale,
    scenario,
    stage: input.stage,
    previousDecisions: [...(input.journeyMemory?.previousDecisions ?? [])],
    knownSlots: known,
    missingSlots: missing,
    destination: r.destination ?? r.destinations[0] ?? plan?.destinations[0] ?? null,
    origin: r.origin ?? null,
    budgetAmount: typeof r.budgetAmount === 'number' ? r.budgetAmount : null,
    budgetCurrency: r.budgetCurrency ?? plan?.estimatedBudget.currency ?? null,
    travelers: typeof r.travelers === 'number' ? r.travelers : null,
    hasTripPlan: Boolean(plan),
    hasFlights: Boolean(plan?.flights.length),
    hasHotels: Boolean(plan?.accommodations.length),
    travelerState,
  }
}

export function inferJourneyStage(input: {
  userText?: string | null
  memory: AgentMemory
  journeyMemory?: JourneyMemorySnapshot | null
}): JourneyStageId {
  const t = (input.userText ?? '').trim()
  const prior = input.journeyMemory?.stage ?? 'conversation'
  const plan = input.memory.tripPlan

  if (/delay|missed (my )?connection|disrupt|cancel(led)? my flight|تأخر|فوت|تعطيل/i.test(t)) {
    return 'disruption'
  }
  if (/book it|reserve (this )?hotel|cancel my booking|confirm|احجز|أؤكد|ألغِ الحجز/i.test(t)) {
    return 'action'
  }
  if (/eta|how far|route|map|كم يبعد|طريق/i.test(t)) return 'maps'
  if (/what('?s| is) next|where am i|companion|ماذا بعد|وين أنا/i.test(t)) return 'companion'
  if (/budget|cheaper|under \d|ميزانية|أرخص/i.test(t)) return 'budget'
  if (/hotel|stay|فندق|إقامة/i.test(t) && !/book|reserve|احجز/i.test(t)) return 'hotels'
  if (/flight|airline|رحلة|طيران/i.test(t) && !/book|احجز/i.test(t)) return 'flights'
  if (/where (should|to) go|destination|compare cities|وين أروح|وجهة/i.test(t)) {
    return 'destination'
  }
  if (/itinerary|plan my trip|خطة|جدول/i.test(t)) return 'planner'
  if (/complete|done|finished|انتهت|خلصت/i.test(t) && plan) return 'completion'

  // Progress from memory when no explicit cue
  if (!plan && collectKnownSlots(input.memory).length < 3) return 'conversation'
  if (!plan) return 'planner'
  if (plan && !plan.flights.length) return 'flights'
  if (plan && !plan.accommodations.length) return 'hotels'
  if (plan && typeof input.memory.requirements.budgetAmount === 'number') {
    const idx = JOURNEY_STAGE_ORDER.indexOf(prior)
    if (idx >= 0 && idx < JOURNEY_STAGE_ORDER.length - 1) {
      return JOURNEY_STAGE_ORDER[Math.min(idx + 1, JOURNEY_STAGE_ORDER.length - 1)]!
    }
  }
  return prior === 'conversation' ? 'intent' : prior
}

function inferTravelerState(
  stage: JourneyStageId,
  plan: TripPlan | null | undefined,
): JourneyHandoffContext['travelerState'] {
  if (stage === 'completion') return 'complete'
  if (stage === 'disruption') return 'recovering'
  if (stage === 'action' || stage === 'companion' || stage === 'maps') {
    return plan ? 'traveling' : 'booking'
  }
  if (stage === 'orchestrator' || stage === 'budget') return 'booking'
  return 'planning'
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
