/**
 * Sprint 83 — Agent definitions (self-registering via registerDefaultAgents).
 * Stubs only — no live providers / booking / UI / Voice.
 */

import { emptyBrainV1Entities, emptyPlannerState } from '../types'
import type {
  BrainAgentContextData,
  BrainAgentDefinition,
  BrainAgentResult,
  BrainAgentSelection,
} from './types'

function tripLike(ctx: BrainAgentContextData): boolean {
  const i = ctx.intent.intent
  return (
    i === 'flight_search'
    || i === 'hotel_search'
    || i === 'package_search'
    || i === 'multi_city_trip'
    || i === 'business_travel'
    || i === 'family_vacation'
    || i === 'weekend_trip'
    || i === 'price_comparison'
    || i === 'price_prediction'
  )
}

function needsFlights(ctx: BrainAgentContextData): boolean {
  const i = ctx.intent.intent
  return (
    i === 'flight_search'
    || i === 'package_search'
    || i === 'multi_city_trip'
    || i === 'business_travel'
    || i === 'family_vacation'
    || i === 'weekend_trip'
    || i === 'price_comparison'
    || i === 'price_prediction'
    || ctx.tools.includes('flights')
  )
}

function needsHotels(ctx: BrainAgentContextData): boolean {
  const i = ctx.intent.intent
  return (
    i === 'hotel_search'
    || i === 'package_search'
    || i === 'family_vacation'
    || i === 'weekend_trip'
    || i === 'business_travel'
    || i === 'multi_city_trip'
    || ctx.tools.includes('hotels')
  )
}

function needsPackages(ctx: BrainAgentContextData): boolean {
  return (
    ctx.intent.intent === 'package_search'
    || ctx.intent.intent === 'family_vacation'
    || ctx.tools.includes('packages')
  )
}

export const plannerAgent: BrainAgentDefinition = {
  id: 'planner',
  name: 'Planner Agent',
  description: 'Selects agents automatically from the registry and sets planner goal',
  dependsOn: [],
  parallelCompatibleWith: [],
  shouldSelect: () => true,
  selectionReason: () => 'Planner is always required to select the agent graph',
  execute: (ctx): BrainAgentResult => {
    // Selection is performed by AgentOrchestrator using registry + shouldSelect.
    // Planner records the goal and echoes selectedAgents already placed on context.
    const goal =
      ctx.intent.intent === 'unknown'
        ? 'Understand traveler request'
        : `Orchestrate agents for ${ctx.intent.intent}`
    const planner = {
      ...(ctx.planner ?? emptyPlannerState()),
      currentGoal: goal,
      continuationSummary: `Planner selected ${ctx.selectedAgents.length} agents`,
    }
    return {
      agentId: 'planner',
      ok: true,
      detail: `Selected ${ctx.selectedAgents.length} agents`,
      patch: { planner },
    }
  },
}

export const memoryAgent: BrainAgentDefinition = {
  id: 'memory',
  name: 'Memory Agent',
  description: 'Loads conversation / preference / long-term memory into context',
  dependsOn: ['planner'],
  parallelCompatibleWith: [],
  shouldSelect: () => true,
  selectionReason: () => 'Memory is required to hydrate preferences and conversation state',
  execute: (ctx): BrainAgentResult => {
    const summary =
      ctx.conversationSummary
      ?? `Intent=${ctx.intent.intent}; destination=${ctx.entities.destination ?? 'n/a'}`
    const preferenceMemory = {
      ...ctx.preferenceMemory,
      preferredAirlines: [...ctx.preferenceMemory.preferredAirlines],
    }
    if (!ctx.entities.cabinClass && preferenceMemory.cabinClass) {
      return {
        agentId: 'memory',
        ok: true,
        detail: 'Loaded preference memory and applied cabin default',
        patch: {
          conversationSummary: summary,
          preferenceMemory,
          entities: { ...ctx.entities, cabinClass: preferenceMemory.cabinClass },
        },
      }
    }
    return {
      agentId: 'memory',
      ok: true,
      detail: 'Loaded session/conversation/preference/long-term memory interfaces',
      patch: { conversationSummary: summary, preferenceMemory },
    }
  },
}

export const travelAgent: BrainAgentDefinition = {
  id: 'travel',
  name: 'Travel Agent',
  description: 'Coordinates travel-domain agent work from entities + intent',
  dependsOn: ['planner', 'memory'],
  parallelCompatibleWith: ['weather', 'maps', 'visa'],
  shouldSelect: (ctx) => tripLike(ctx) || ctx.intent.intent === 'travel_advice',
  selectionReason: (ctx) => `Travel coordination needed for intent=${ctx.intent.intent}`,
  execute: (ctx): BrainAgentResult => {
    const tools = [...ctx.tools]
    if (needsFlights(ctx) && !tools.includes('flights')) tools.push('flights')
    if (needsHotels(ctx) && !tools.includes('hotels')) tools.push('hotels')
    if (needsPackages(ctx) && !tools.includes('packages')) tools.push('packages')
    return {
      agentId: 'travel',
      ok: true,
      detail: `Travel scope ready; tools=${tools.join(',') || 'none'}`,
      patch: { tools: tools.length ? tools : ctx.tools },
    }
  },
}

export const flightAgent: BrainAgentDefinition = {
  id: 'flight',
  name: 'Flight Agent',
  description: 'Collects injectable flight offers (no live providers)',
  dependsOn: ['travel'],
  parallelCompatibleWith: ['hotel', 'package'],
  shouldSelect: (ctx) => needsFlights(ctx) && ctx.missing.length === 0,
  selectionReason: (ctx) => `Flight search required for intent=${ctx.intent.intent}`,
  execute: (ctx): BrainAgentResult => {
    const flights = ctx.candidateOffers.filter((o) => o.kind === 'flight')
    return {
      agentId: 'flight',
      ok: true,
      detail: `Collected ${flights.length} flight offer stub(s)`,
      // Return only this agent's additions — orchestrator merges parallel patches.
      patch: { providerResults: flights },
    }
  },
}

export const hotelAgent: BrainAgentDefinition = {
  id: 'hotel',
  name: 'Hotel Agent',
  description: 'Collects injectable hotel offers (no live providers)',
  dependsOn: ['travel'],
  parallelCompatibleWith: ['flight', 'package'],
  shouldSelect: (ctx) => needsHotels(ctx) && ctx.missing.length === 0,
  selectionReason: (ctx) => `Hotel search required for intent=${ctx.intent.intent}`,
  execute: (ctx): BrainAgentResult => {
    const hotels = ctx.candidateOffers.filter((o) => o.kind === 'hotel')
    return {
      agentId: 'hotel',
      ok: true,
      detail: `Collected ${hotels.length} hotel offer stub(s)`,
      patch: { providerResults: hotels },
    }
  },
}

export const packageAgent: BrainAgentDefinition = {
  id: 'package',
  name: 'Package Agent',
  description: 'Collects injectable package offers (no live providers)',
  dependsOn: ['travel'],
  parallelCompatibleWith: ['flight', 'hotel'],
  shouldSelect: (ctx) => needsPackages(ctx) && ctx.missing.length === 0,
  selectionReason: (ctx) => `Package search required for intent=${ctx.intent.intent}`,
  execute: (ctx): BrainAgentResult => {
    const packages = ctx.candidateOffers.filter((o) => o.kind === 'package')
    return {
      agentId: 'package',
      ok: true,
      detail: `Collected ${packages.length} package offer stub(s)`,
      patch: { providerResults: packages },
    }
  },
}

export const weatherAgent: BrainAgentDefinition = {
  id: 'weather',
  name: 'Weather Agent',
  description: 'Destination weather context stub',
  dependsOn: ['memory'],
  parallelCompatibleWith: ['maps', 'visa', 'travel'],
  shouldSelect: (ctx) =>
    tripLike(ctx)
    || ctx.intent.intent === 'travel_advice'
    || ctx.tools.includes('weather'),
  selectionReason: () => 'Weather context improves recommendation timing advice',
  execute: (ctx): BrainAgentResult => ({
    agentId: 'weather',
    ok: true,
    detail: `Weather stub for ${ctx.entities.destination ?? 'destination'}`,
  }),
}

export const mapsAgent: BrainAgentDefinition = {
  id: 'maps',
  name: 'Maps Agent',
  description: 'Destination maps / routing context stub',
  dependsOn: ['memory'],
  parallelCompatibleWith: ['weather', 'visa', 'travel'],
  shouldSelect: (ctx) =>
    tripLike(ctx)
    || ctx.intent.intent === 'travel_advice'
    || ctx.tools.includes('maps'),
  selectionReason: () => 'Maps context supports multi-stop and destination orientation',
  execute: (ctx): BrainAgentResult => ({
    agentId: 'maps',
    ok: true,
    detail: `Maps stub for ${ctx.entities.destination ?? 'destination'}`,
  }),
}

export const visaAgent: BrainAgentDefinition = {
  id: 'visa',
  name: 'Visa Agent',
  description: 'Visa guidance stub',
  dependsOn: ['memory'],
  parallelCompatibleWith: ['weather', 'maps', 'travel'],
  shouldSelect: (ctx) =>
    ctx.intent.intent === 'visa_question'
    || Boolean(ctx.entities.visaDestination)
    || tripLike(ctx),
  selectionReason: (ctx) =>
    ctx.intent.intent === 'visa_question'
      ? 'User asked a visa question'
      : 'Visa check recommended for international trip planning',
  execute: (ctx): BrainAgentResult => ({
    agentId: 'visa',
    ok: true,
    detail: `Visa stub for ${ctx.entities.visaDestination ?? ctx.entities.destination ?? 'destination'}`,
  }),
}

export const pricingAgent: BrainAgentDefinition = {
  id: 'pricing',
  name: 'Pricing Agent',
  description: 'Ranks / prices collected offers (injectable only)',
  dependsOn: ['flight', 'hotel', 'package'],
  parallelCompatibleWith: [],
  shouldSelect: (ctx) =>
    ctx.missing.length === 0
    && (needsFlights(ctx) || needsHotels(ctx) || needsPackages(ctx)),
  selectionReason: () => 'Pricing aggregates flight/hotel/package results before booking',
  execute: (ctx): BrainAgentResult => {
    const ranked = [...ctx.providerResults].sort(
      (a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY),
    ).map((offer, index) => ({
      ...offer,
      score: Math.max(0, 100 - index * 5 - (offer.price ?? 0) / 1000),
      reasons: [...(offer.reasons ?? []), 'Pricing agent scored'],
    }))
    const top = ranked[0] ?? null
    const explanation = top
      ? {
          offerId: top.id,
          ar: `تم اختيار ${top.title} بناءً على السعر والقيمة.`,
          en: `Selected ${top.title} based on price and value.`,
          comparedToId: ranked[1]?.id ?? null,
          deltas: { priceDiff: null, durationMinutesDiff: null, stopsDiff: null },
        }
      : null
    return {
      agentId: 'pricing',
      ok: true,
      detail: `Priced ${ranked.length} offer(s)`,
      patch: { rankedOffers: ranked, explanation },
    }
  },
}

export const bookingAgent: BrainAgentDefinition = {
  id: 'booking',
  name: 'Booking Agent',
  description: 'Prepares booking action stubs (does not modify booking module)',
  dependsOn: ['planner', 'flight', 'hotel', 'pricing'],
  parallelCompatibleWith: [],
  shouldSelect: (ctx) => ctx.missing.length === 0 && tripLike(ctx),
  selectionReason: () =>
    'Booking waits for planner + flights + hotels + pricing before preparing actions',
  execute: (ctx): BrainAgentResult => {
    const top = ctx.rankedOffers[0]
    if (!top) {
      return {
        agentId: 'booking',
        ok: true,
        detail: 'No offer ready for booking actions',
        patch: { bookingActions: [] },
      }
    }
    return {
      agentId: 'booking',
      ok: true,
      detail: `Prepared booking stub for ${top.id}`,
      patch: {
        bookingActions: [{
          type: 'prepare_booking',
          label: 'Prepare booking',
          payload: { offerId: top.id, kind: top.kind, agent: 'booking' },
        }],
      },
    }
  },
}

export const safetyAgent: BrainAgentDefinition = {
  id: 'safety',
  name: 'Safety Agent',
  description: 'Guards outbound response text',
  dependsOn: ['booking', 'pricing', 'memory'],
  parallelCompatibleWith: [],
  shouldSelect: () => true,
  selectionReason: () => 'Safety gate is required before response delivery',
  execute: (ctx): BrainAgentResult => {
    const blocked = /ignore (all|previous) instructions/i.test(ctx.text)
    return {
      agentId: 'safety',
      ok: !blocked,
      detail: blocked ? 'Blocked unsafe prompt pattern' : 'Safety checks passed',
      patch: {
        safe: !blocked,
        safetyNotes: blocked ? ['unsafe_prompt_pattern'] : ['safety_ok'],
      },
    }
  },
}

export const responseAgent: BrainAgentDefinition = {
  id: 'response',
  name: 'Response Agent',
  description: 'Composes natural conversational answer from context',
  dependsOn: ['safety'],
  parallelCompatibleWith: [],
  shouldSelect: () => true,
  selectionReason: () => 'Response agent authors the traveler-facing answer',
  execute: (ctx): BrainAgentResult => {
    if (!ctx.safe) {
      return {
        agentId: 'response',
        ok: true,
        detail: 'Safe refusal response',
        patch: {
          responseAr: 'لا يمكنني تنفيذ هذا الطلب.',
          responseEn: 'I cannot fulfill that request.',
        },
      }
    }
    if (ctx.missing.length > 0) {
      return {
        agentId: 'response',
        ok: true,
        detail: 'Clarification response',
        patch: {
          responseAr: 'متى تود السفر؟',
          responseEn: 'When would you like to travel?',
        },
      }
    }
    const top = ctx.rankedOffers[0]
    if (top) {
      const why = ctx.explanation?.en ?? 'best overall fit'
      return {
        agentId: 'response',
        ok: true,
        detail: 'Recommendation response',
        patch: {
          responseAr: `أقترح: ${top.title}. ${ctx.explanation?.ar ?? ''}`.trim(),
          responseEn: `I recommend: ${top.title}. ${why}`,
        },
      }
    }
    return {
      agentId: 'response',
      ok: true,
      detail: 'Generic consultant response',
      patch: {
        responseAr: 'أخبرني المزيد عن رحلتك وسأرتب الخيارات.',
        responseEn: 'Tell me more about your trip and I will arrange options.',
      },
    }
  },
}

/** All built-in agent definitions (registered explicitly; orchestrator does not hardcode them). */
export const DEFAULT_BRAIN_AGENTS: BrainAgentDefinition[] = [
  plannerAgent,
  memoryAgent,
  travelAgent,
  flightAgent,
  hotelAgent,
  packageAgent,
  weatherAgent,
  mapsAgent,
  visaAgent,
  pricingAgent,
  bookingAgent,
  safetyAgent,
  responseAgent,
]

export function createEmptyAgentContextData(
  partial?: Partial<BrainAgentContextData>,
): BrainAgentContextData {
  return {
    text: '',
    locale: 'ar',
    intent: { intent: 'unknown', confidence: 0, secondary: [] },
    entities: emptyBrainV1Entities(),
    missing: [],
    tools: ['none'],
    conversationSummary: null,
    preferenceMemory: {
      cabinClass: null,
      maxStops: null,
      preferredAirlines: [],
      hotelStarMin: null,
      refundablePreferred: false,
      currency: null,
      typicalBudget: null,
    },
    longTerm: null,
    planner: null,
    reasoning: [],
    providerResults: [],
    rankedOffers: [],
    explanation: null,
    responseAr: '',
    responseEn: '',
    bookingActions: [],
    safe: true,
    safetyNotes: [],
    selectedAgents: [] as BrainAgentSelection[],
    candidateOffers: [],
    ...partial,
  }
}
