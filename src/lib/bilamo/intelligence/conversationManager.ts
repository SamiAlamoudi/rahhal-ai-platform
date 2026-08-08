/**
 * Bilamo Conversation Manager — senior luxury travel consultant brain.
 *
 * Flow: extract → remember → detect missing (min one question) → parallel search → compose.
 * Never asks budget. Never asks twice. Soft-fail callers should catch errors.
 */

import { resolveDestinationIdentity } from '../../agent/destinationIdentity'
import { missingClarificationFields } from '../../agent/clarification'
import { emptyMemory, withTripPlan, type AgentLocale, type TripPlan } from '../../agent/types'
import type { AgentMemory, AgentProviderMeta } from '../../agent/types'
import { detectReplyLocale } from '../../agent/locale'
import {
  coerceAgentLocale,
  coerceReplyLocale,
  replyLocaleToAgentLocale,
  type BilamoReplyLocale,
} from '../speech/localeBridge'
import { assessDestinationConfidence } from '../speech/speechUnderstanding'
import type { ChatMessage } from '../../chat/chatTypes'
import {
  acknowledgeAndAsk,
  canSearch,
  nextMinimumQuestion,
  withSearchDefaults,
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
  return /^(hi|hello|hey|bonjour|salut|bonsoir|مرحبا|أهلا|اهلا|السلام عليكم|صباح الخير|مساء الخير|good\s+(morning|evening|afternoon)|howdy|مرحبا\s*بيلامو)[\s!.?؟]*$/i.test(
    t,
  )
}

function composeDestinationConfirm(
  locale: BilamoReplyLocale,
  label: string,
): { displayText: string; spokenText: string } {
  if (locale === 'fr') {
    const displayText = `J'ai compris ${label} — c'est bien ça ?`
    return { displayText, spokenText: displayText }
  }
  if (locale === 'en') {
    const displayText = `I heard ${label} — is that correct?`
    return { displayText, spokenText: displayText }
  }
  const displayText = `سمعت ${label} — هل هذا صحيح؟`
  return { displayText, spokenText: displayText }
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
  locale: AgentLocale,
): TripPlan {
  const dest = requirements.destination || requirements.destinations[0] || 'Trip'
  const nights = requirements.durationDays ?? 4
  const flight = search.flights[0]
  const hotel = search.hotels[0]
  const currency = flight?.currency || hotel?.currency || requirements.budgetCurrency || 'SAR'
  const total = (flight?.price ?? 0) + (hotel?.price ?? 0)
  const dailyItinerary = Array.from({ length: Math.min(nights, 3) }, (_, i) => ({
    day: i + 1,
    title: locale === 'ar'
      ? (i === 0 ? `الوصول إلى ${dest}` : `اليوم ${i + 1} في ${dest}`)
      : (i === 0 ? `Arrive ${dest}` : `Day ${i + 1} in ${dest}`),
    location: dest,
    activities: [
      {
        time: i === 0
          ? (locale === 'ar' ? 'صباحًا' : 'Morning')
          : null,
        title: i === 0
          ? (flight
            ? (locale === 'ar' ? `وصول ${flight.airline}` : `${flight.airline} arrival`)
            : (locale === 'ar' ? 'الوصول' : 'Arrival'))
          : (locale === 'ar' ? 'يوم مفتوح بإيقاعك' : 'Open day at your pace'),
        description: i === 0
          ? (locale === 'ar'
            ? 'وصول هادئ وانتقال خاص إلى الإقامة.'
            : 'Soft landing and private transfer to your stay.')
          : (locale === 'ar'
            ? 'مُرتّب حسب ما تحب — بدون جدول صارم.'
            : 'Shaped around what you enjoy — no rigid checklist.'),
      },
    ],
  }))
  const budget = {
    amount: total,
    currency,
    breakdown: [
      ...(flight ? [{ label: locale === 'ar' ? 'الطيران' : 'Flights', amount: flight.price }] : []),
      ...(hotel ? [{ label: locale === 'ar' ? 'الإقامة' : 'Stay', amount: hotel.price }] : []),
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
  const agentLocale = coerceAgentLocale(result.memory.locale, 'ar')
  const replyLanguage = coerceReplyLocale(result.memory.replyLanguage, agentLocale === 'en' ? 'en' : 'ar')
  const tripPlan = result.search
    ? buildConsultantTripPlan(result.requirements, result.search, agentLocale)
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
      replyLanguage,
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

  // Per-turn reply language (includes French). AgentLocale stays ar|en.
  const replyLanguage = detectReplyLocale(
    input.userText,
    coerceReplyLocale(memory.replyLanguage, memory.locale === 'en' ? 'en' : 'ar'),
  )
  const agentLocale = replyLocaleToAgentLocale(replyLanguage)
  memory = { ...memory, locale: agentLocale, replyLanguage }

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

  const locale = replyLanguage
  memory = {
    ...memory,
    locale: agentLocale,
    replyLanguage: locale,
    agent: {
      ...(memory.agent.locale ? memory.agent : emptyMemory(agentLocale)),
      locale: agentLocale,
      lastIntent: extraction.intent,
      requirements,
    },
  }
  memory = syncPreferencesFromRequirements(memory, requirements)

  // Low-confidence / unknown destination → one confirmation, never invent search.
  if (requirements.destination) {
    const destConf = assessDestinationConfidence(requirements.destination)
    if (destConf.needsConfirm && destConf.label) {
      const confirm = composeDestinationConfirm(locale, destConf.label)
      await streamConsultantText({
        ...confirm,
        onDelta: input.onDelta,
        signal: input.signal,
      })
      memory = rememberAsked({ ...memory, phase: 'collecting' }, 'destination')
      return {
        version: BILAMO_INTELLIGENCE_VERSION,
        phase: 'collecting',
        displayText: confirm.displayText,
        spokenText: confirm.spokenText,
        memory,
        search: null,
        askedSlot: 'destination',
        requirements,
      }
    }
  }
  // Soft-default solo only for readiness/search — do not persist assumed travelers
  // during collecting, or follow-up turns lose the "assumed solo" acknowledgment.
  const travelersAssumed = requirements.travelers == null
  const searchRequirements = withSearchDefaults(requirements)
  memory = {
    ...memory,
    agent: { ...memory.agent, requirements },
  }

  // Pure greeting with no travel signal → consultant welcome.
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
    }
  }

  const askedSlot = nextMinimumQuestion({
    requirements: searchRequirements,
    askedSlots: memory.askedSlots,
  })

  if (askedSlot || !canSearch(searchRequirements)) {
    const slot = askedSlot ?? nextMinimumQuestion({
      requirements: searchRequirements,
      askedSlots: [],
    })
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
    }
  }

  // Ready to search — materialize soft defaults into the search requirements.
  requirements = searchRequirements
  memory = {
    ...memory,
    phase: 'searching',
    agent: { ...memory.agent, requirements },
  }
  // Progress is ephemeral UI only — never arm TTS or append permanent assistant turns.
  const pushProgress = (_message: string) => {
    /* status line / thinking orb owns progressive acks */
  }
  pushProgress(
    locale === 'ar'
      ? 'لديّ ما يكفي — أرتّب الآن.'
      : locale === 'fr'
        ? 'J\'ai assez d\'éléments — j\'organise maintenant.'
        : 'I have enough — arranging now.',
  )

  const search = await runBilamoSearchOrchestrator({
    requirements,
    signal: input.signal,
    locale: agentLocale,
    onFlightProgress: (message) => {
      if (/enough information to search/i.test(message)) return
      pushProgress(message)
    },
  })

  const copy = composeRecommendation({
    requirements,
    search,
    locale,
    assumedSolo: travelersAssumed && requirements.travelers === 1,
  })
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
  }
}

export function emptySessionMemory(locale: AgentLocale = 'ar'): BilamoConsultantMemory {
  return emptyBilamoMemory(locale)
}
