import type {
  BrainLocale,
  BrainResponsePlan,
  ConversationMemory,
  TravelPlan,
  TravelPlanDomainLink,
  TravelPlanPassengerLink,
} from './types'

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Sprint 21 — build a structured TravelPlan from Brain memory + response plan.
 * Connects flights, hotels, itinerary, booking session, and passenger profiles.
 */
export function buildTravelPlan(input: {
  memory: ConversationMemory
  plan: Omit<BrainResponsePlan, 'travelPlan'>
  locale: BrainLocale
}): TravelPlan {
  const memory = input.memory
  const ready = input.plan.action !== 'ask_missing' && input.plan.missingFields.length === 0
  const destination = memory.destination
  const origin = memory.origin
  const startDate = memory.travelDates.startDate
  const endDate = memory.travelDates.endDate

  const flights = linkFlights(memory, ready && input.plan.action === 'search_flights')
  const hotels = linkHotels(
    memory,
    ready && (input.plan.action === 'search_hotels' || memory.hotelRequirement === true),
  )
  const itinerary = linkItinerary(memory, ready)
  const bookingSession = linkBooking(memory, ready)
  const passengers = linkPassengers(memory)

  const summaryParts: string[] = []
  if (destination) summaryParts.push(destination)
  if (origin) summaryParts.push(`from:${origin}`)
  if (memory.travelers.count != null) summaryParts.push(`pax:${memory.travelers.count}`)
  if (ready) summaryParts.push(`action:${input.plan.action}`)
  else summaryParts.push('collecting')

  return {
    id: newId('travel_plan'),
    conversationId: memory.conversationId,
    locale: input.locale,
    status: ready ? 'ready' : 'collecting',
    summary: summaryParts.join('|'),
    destination,
    origin,
    dates: { ...memory.travelDates },
    travelers: { ...memory.travelers },
    cabinClass: memory.cabinClass,
    budget: { ...memory.budget },
    preferredAirlines: [...memory.airlinePreferences],
    preferredHotels: [...memory.hotelPreferences],
    hotelRequired: memory.hotelRequirement,
    activities: [...memory.activities],
    flights,
    hotels,
    itinerary,
    bookingSession,
    passengers,
  }
}

function linkFlights(memory: ConversationMemory, ready: boolean): TravelPlanDomainLink {
  return {
    kind: 'flights',
    ready: ready && Boolean(memory.destination),
    destination: memory.destination,
    origin: memory.origin,
    startDate: memory.travelDates.startDate,
    endDate: memory.travelDates.endDate,
    notes: memory.airlinePreferences.map((a) => `airline:${a}`),
  }
}

function linkHotels(memory: ConversationMemory, ready: boolean): TravelPlanDomainLink {
  return {
    kind: 'hotels',
    ready: ready && Boolean(memory.destination) && memory.hotelRequirement !== false,
    destination: memory.destination,
    origin: null,
    startDate: memory.travelDates.startDate,
    endDate: memory.travelDates.endDate,
    notes: memory.hotelPreferences.map((h) => `hotel:${h}`),
  }
}

function linkItinerary(memory: ConversationMemory, ready: boolean): TravelPlanDomainLink {
  return {
    kind: 'itinerary',
    ready: ready && Boolean(memory.destination),
    destination: memory.destination,
    origin: memory.origin,
    startDate: memory.travelDates.startDate,
    endDate: memory.travelDates.endDate,
    notes: memory.activities.map((a) => `activity:${a}`),
  }
}

function linkBooking(memory: ConversationMemory, ready: boolean): TravelPlanDomainLink {
  return {
    kind: 'booking_session',
    ready,
    destination: memory.destination,
    origin: memory.origin,
    startDate: memory.travelDates.startDate,
    endDate: memory.travelDates.endDate,
    notes: ['status:draft'],
  }
}

function linkPassengers(memory: ConversationMemory): TravelPlanPassengerLink {
  const adults = memory.travelers.adults ?? memory.travelers.count ?? 0
  const children = memory.travelers.children ?? 0
  const infants = memory.travelers.infants ?? 0
  const total =
    memory.travelers.count ??
    (adults + children + infants > 0 ? adults + children + infants : 0)
  return {
    kind: 'passengers',
    ready: total > 0,
    adults: adults || (total > 0 ? total : 0),
    children,
    infants,
    total,
    slotCount: total,
  }
}
