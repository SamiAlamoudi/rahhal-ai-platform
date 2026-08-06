/**
 * Bilamo Conversation Manager — senior luxury travel consultant brain.
 *
 * Flow: extract → remember → detect missing (min one question) → parallel search → compose.
 * Never asks budget. Never asks twice. Soft-fail callers should catch errors.
 */

import { resolveDestinationIdentity } from '../../agent/destinationIdentity'
import { missingClarificationFields } from '../../agent/clarification'
import { emptyMemory, withTripPlan, type TripPlan } from '../../agent/types'
import type { AgentMemory, AgentProviderMeta } from '../../agent/types'
import type { ChatMessage } from '../../chat/chatTypes'
import {
  acknowledgeAndAsk,
  canSearch,
  nextMinimumQuestion,
} from './clarification'
import {
  composeGreeting,
  composeRecommendation,
  streamConsultantText,
} from './consultantComposer'
import { extractBilamoEntities } from './entityExtraction'
import { BILAMO_INTELLIGENCE_FEATURE_VERSION } from './feature'
import { runBilamoSearchOrchestrator } from './searchOrchestrator'
import {
  emptyBilamoMemory,
  hydrateBilamoMemory,
  rememberAsked,
  syncPreferencesFromRequirements,
} from './smartMemory'
import {
  BILAMO_INTELLIGENCE_VERSION,
  type BilamoConsultantMemory,
  type BilamoTurnInput,
  type BilamoTurnResult,
} from './types'

function isGreetingOnly(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t) return true
  return /^(hi|hello|hey|مرحبا|أهلا|اهلا|السلام عليكم|صباح الخير|مساء الخير|good\s+(morning|evening|afternoon)|howdy)[\s!.?؟]*$/i.test(
    t,
  )
}

function shouldDeferToLegacy(intent: string, userText: string): boolean {
  // Booking / payment / regenerate / edit / save stay on the full planTurn spine.
  if (
    /^(regenerate|regenerate_day|edit|save|booking_|show_checkout|how_much|is_order|what_is_payment|show_confirmation|booking_confirmed|booking_reference|booking_status)/i.test(
      intent,
    )
  ) {
    return true
  }
  if (
    /\b(pay|checkout|confirm booking|save (the )?(plan|trip|itinerary)|احجز|ادفع|تأكيد الحجز|احفظ)\b/i.test(
      userText,
    )
  ) {
    return true
  }
  return false
}

function toAgentMemory(
  bilamo: BilamoConsultantMemory,
  requirements: BilamoTurnResult['requirements'],
  phase: BilamoTurnResult['phase'],
  tripPlan: TripPlan | null = null,
): AgentMemory {
  const agentPhase: AgentMemory['phase'] =
    phase === 'recommending' || phase === 'refining' || phase === 'searching'
      ? 'planned'
      : 'collecting'

  const missing = missingClarificationFields(requirements, { smart: true })

  return withTripPlan({
    ...bilamo.agent,
    locale: bilamo.locale,
    phase: agentPhase,
    requirements,
    missingFields: missing,
  }, tripPlan ?? bilamo.agent.tripPlan)
}

function buildConsultantTripPlan(
  requirements: BilamoTurnResult['requirements'],
  search: NonNullable<BilamoTurnResult['search']>,
  locale: 'ar' | 'en',
): TripPlan {
  const dest = requirements.destination || requirements.destinations[0] || 'Trip'
  const nights = requirements.durationDays ?? 4
  const flight = search.flights[0]
  const hotel = search.hotels[0]
  const currency = flight?.currency || hotel?.currency || requirements.budgetCurrency || 'SAR'
  const total = (flight?.price ?? 0) + (hotel?.price ?? 0)
  const dailyItinerary = Array.from({ length: Math.min(nights, 3) }, (_, i) => ({
    day: i + 1,
    title: i === 0 ? `Arrive ${dest}` : `Day ${i + 1} in ${dest}`,
    location: dest,
    activities: [
      {
        time: i === 0 ? 'Morning' : null,
        title: i === 0
          ? (flight ? `${flight.airline} arrival` : 'Arrival')
          : 'Open day at your pace',
        description: i === 0
          ? 'Soft landing and private transfer to your stay.'
          : 'Shaped around what you enjoy — no rigid checklist.',
      },
    ],
  }))
  const budget = {
    amount: total,
    currency,
    breakdown: [
      ...(flight ? [{ label: 'Flights', amount: flight.price }] : []),
      ...(hotel ? [{ label: 'Stay', amount: hotel.price }] : []),
    ],
  }
  return {
    id: `bilamo_${Date.now()}`,
    title: `${dest} · Bilamo`,
    summary: search.context.weather || `Curated outline for ${dest}.`,
    locale,
    destinations: [dest],
    startDate: requirements.startDate,
    endDate: requirements.endDate,
    durationDays: nights,
    travelers: requirements.travelers,
    travelerType: requirements.travelerType,
    interests: [...requirements.interests],
    dailyItinerary,
    activities: dailyItinerary,
    transportation: search.context.transfer
      ? [{
          mode: 'private_transfer',
          from: 'Airport',
          to: hotel?.area || 'Hotel',
          notes: search.context.transfer,
          estimatedCost: null,
          currency,
        }]
      : [],
    flights: flight
      ? [{
          id: flight.id,
          from: flight.origin,
          to: flight.destination,
          airline: flight.airline,
          stops: flight.stopsLabel === 'Nonstop' ? 0 : 1,
          estimatedCost: flight.price,
          currency: flight.currency,
          notes: flight.reason,
          departureTime: flight.departTime,
          arrivalTime: flight.arriveTime,
          fromProvider: true,
          provider: 'mock',
        }]
      : [],
    accommodations: hotel
      ? [{
          name: hotel.name,
          area: hotel.area,
          category: 'hotel',
          fit: hotel.reason,
          estimatedNightly: Math.round(hotel.price / Math.max(1, nights)),
          currency: hotel.currency,
          fromProvider: true,
          provider: 'mock',
        }]
      : [],
    attractions: [],
    weatherNotes: search.context.weather ? [search.context.weather] : [],
    visaNotes: search.context.visa ? [search.context.visa] : [],
    travelTips: search.context.timeDifference ? [search.context.timeDifference] : [],
    packingSuggestions: [],
    estimatedBudget: budget,
    estimatedCosts: budget,
    notes: [],
    conversationId: '',
    requirements,
    updatedAt: new Date().toISOString(),
  }
}

function bookingOptionsFromSearch(
  search: BilamoTurnResult['search'],
): NonNullable<AgentProviderMeta['bookingOptions']> {
  if (!search) return []
  const flights = search.flights.slice(0, 3).map((f) => ({
    id: f.id,
    kind: 'flight' as const,
    airline: f.airline,
    from: f.origin,
    to: f.destination,
    departureTime: f.departTime,
    arrivalTime: f.arriveTime,
    stops: f.stopsLabel === 'Nonstop' ? 0 : 1,
    price: f.price,
    currency: f.currency,
    provider: 'mock',
    selectable: true as const,
  }))
  const hotels = search.hotels.slice(0, 2).map((h) => ({
    id: h.id,
    kind: 'hotel' as const,
    hotelName: h.name,
    area: h.area,
    price: h.price,
    currency: h.currency,
    provider: 'mock',
    selectable: true as const,
  }))
  return [...flights, ...hotels]
}

export function bilamoResultToTravelAgentTurn(result: BilamoTurnResult): {
  reply: string
  memory: AgentMemory
  tripPlan: AgentMemory['tripPlan']
  meta: AgentProviderMeta
  toolBatch: null
} {
  const locale = result.memory.locale === 'en' ? 'en' : 'ar'
  const tripPlan = result.search
    ? buildConsultantTripPlan(result.requirements, result.search, locale)
    : null
  const memory = toAgentMemory(result.memory, result.requirements, result.phase, tripPlan)
  const bookingOptions = bookingOptionsFromSearch(result.search)
  const dest = result.requirements.destination

  const meta: AgentProviderMeta = {
    kind: 'travel_agent',
    version: 2,
    memory,
    tripPlan: memory.tripPlan,
    itinerary: memory.tripPlan,
    spokenText: result.spokenText,
    voicePhase: 'final',
    bookingOptions: bookingOptions.length ? bookingOptions : undefined,
    bookingSearch: result.search
      ? {
          intent: 'booking',
          destination: dest,
          origin: result.requirements.origin,
          startDate: result.requirements.startDate,
          endDate: result.requirements.endDate,
          travelers: result.requirements.travelers,
          cabin: result.requirements.cabinPreference,
          searchInvoked: true,
          providerFlightCount: result.search.flights.length,
          providerHotelCount: result.search.hotels.length,
          normalizedFlightCount: result.search.flights.length,
          cardsRenderedCount: bookingOptions.length,
          providerError: null,
        }
      : undefined,
    bilamo: {
      version: BILAMO_INTELLIGENCE_VERSION,
      featureVersion: BILAMO_INTELLIGENCE_FEATURE_VERSION,
      phase: result.phase,
      askedSlot: result.askedSlot,
      search: result.search,
      preferences: { ...result.memory.preferences },
      askedSlots: [...result.memory.askedSlots],
      arabicDialect: result.memory.arabicDialect,
      arabic: result.arabic
        ? {
            dialect: result.arabic.detection.dialect,
            confidence: result.arabic.detection.confidence,
            normalizedText: result.arabic.normalizedText,
          }
        : null,
    } as NonNullable<AgentProviderMeta['bilamo']>,
  }

  return {
    reply: result.displayText,
    memory,
    tripPlan: memory.tripPlan,
    meta,
    toolBatch: null,
  }
}

/**
 * Main Bilamo turn. Returns null when the legacy planTurn spine should continue.
 */
export async function runBilamoIntelligenceTurn(
  input: BilamoTurnInput,
): Promise<BilamoTurnResult | null> {
  const chatMessages = input.messages as ChatMessage[]
  let memory = hydrateBilamoMemory({
    messages: chatMessages,
    prior: input.priorMemory,
  })

  const extraction = extractBilamoEntities({
    userText: input.userText,
    memory,
  })

  if (shouldDeferToLegacy(extraction.intent, input.userText)) {
    return null
  }

  let requirements = extraction.requirements
  if (requirements.destination) {
    const identity = resolveDestinationIdentity(requirements.destination)
    if (identity) {
      requirements = {
        ...requirements,
        destination: identity.label,
        destinations: [identity.label],
        destinationCity: requirements.destinationCity ?? identity.city,
        destinationCountry: requirements.destinationCountry ?? identity.country,
      }
    }
  }

  memory = {
    ...memory,
    locale: extraction.locale,
    arabicDialect: extraction.arabic.detection.dialect,
    agent: {
      ...(memory.agent.locale ? memory.agent : emptyMemory(extraction.locale)),
      locale: extraction.locale,
      lastIntent: extraction.intent,
      requirements,
    },
  }
  memory = syncPreferencesFromRequirements(memory, requirements)

  const locale = memory.locale === 'en' ? 'en' : 'ar'
  const arabic = extraction.arabic

  // Pure greeting with no travel signal → consultant welcome.
  // Responses stay clear modern Arabic — dialect is detected, not imitated.
  if (
    isGreetingOnly(input.userText)
    && !requirements.destination
    && requirements.destinations.length === 0
    && !requirements.destinationFlexible
  ) {
    const copy = composeGreeting(locale)
    await streamConsultantText({
      ...copy,
      onDelta: input.onDelta,
      signal: input.signal,
    })
    memory = rememberAsked({ ...memory, phase: 'greeting' }, 'destination')
    return {
      version: BILAMO_INTELLIGENCE_VERSION,
      phase: 'greeting',
      displayText: copy.displayText,
      spokenText: copy.spokenText,
      memory,
      search: null,
      askedSlot: 'destination',
      requirements,
      arabic,
    }
  }

  const askedSlot = nextMinimumQuestion({
    requirements,
    askedSlots: memory.askedSlots,
  })

  if (askedSlot || !canSearch(requirements)) {
    const slot = askedSlot ?? nextMinimumQuestion({ requirements, askedSlots: [] })
    if (!slot) {
      // Should not happen; fall through.
      return null
    }
    const copy = acknowledgeAndAsk(memory, slot, requirements)
    await streamConsultantText({
      ...copy,
      onDelta: input.onDelta,
      signal: input.signal,
    })
    memory = rememberAsked({ ...memory, phase: 'collecting' }, slot)
    memory = {
      ...memory,
      agent: { ...memory.agent, phase: 'collecting', requirements },
    }
    return {
      version: BILAMO_INTELLIGENCE_VERSION,
      phase: 'collecting',
      displayText: copy.displayText,
      spokenText: copy.spokenText,
      memory,
      search: null,
      askedSlot: slot,
      requirements,
      arabic,
    }
  }

  // Ready to search — parallel orchestrator.
  memory = { ...memory, phase: 'searching' }
  input.onDelta?.({
    displayText: locale === 'ar' ? 'أرتّب لك الخيارات الآن…' : 'I’m shaping the options now…',
    spokenText: locale === 'ar' ? 'لحظة…' : 'One moment…',
  })

  const search = await runBilamoSearchOrchestrator({
    requirements,
    signal: input.signal,
  })

  const copy = composeRecommendation({ requirements, search, locale })
  await streamConsultantText({
    ...copy,
    onDelta: input.onDelta,
    signal: input.signal,
  })

  memory = {
    ...memory,
    phase: 'recommending',
    agent: withTripPlan(
      { ...memory.agent, phase: 'planned', requirements },
      memory.agent.tripPlan,
    ),
  }

  return {
    version: BILAMO_INTELLIGENCE_VERSION,
    phase: 'recommending',
    displayText: copy.displayText,
    spokenText: copy.spokenText,
    memory,
    search,
    askedSlot: null,
    requirements,
    arabic,
  }
}

export function emptySessionMemory(locale: 'ar' | 'en' = 'en'): BilamoConsultantMemory {
  return emptyBilamoMemory(locale)
}
