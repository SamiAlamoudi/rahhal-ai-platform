import { createPassengerSlots } from '../passengers/createPassengerSlots'
import type { TravellerCounts } from '../passengers/types'
import type {
  BrainMemorySlot,
  BrainResponsePlan,
  ConversationMemory,
  TravelDomainBridge,
  TravelSearchDraft,
} from './types'

/**
 * Sprint 21 — bridge BrainResponsePlan to real travel domain drafts.
 * No live Amadeus/Booking/LLM calls — structured drafts only.
 */
export function buildTravelDomainBridge(input: {
  memory: ConversationMemory
  plan: BrainResponsePlan
}): TravelDomainBridge {
  const memory = input.memory
  const ready =
    input.plan.action !== 'ask_missing' && input.plan.missingFields.length === 0

  const passengerCounts = toPassengerCounts(memory)
  const passengerSlotIds =
    passengerCounts && passengerCounts.total > 0
      ? createPassengerSlots(passengerCounts).map((p) => p.id)
      : []

  const searchDraft = toSearchDraft(memory, input.plan.missingFields, ready)

  const itemKinds: Array<'flight' | 'hotel' | 'package'> = []
  if (
    input.plan.action === 'search_flights' ||
    input.plan.searchRequests.some((s) => s.kind === 'flights')
  ) {
    itemKinds.push('flight')
  }
  if (
    input.plan.action === 'search_hotels' ||
    memory.hotelRequirement === true ||
    input.plan.searchRequests.some((s) => s.kind === 'hotels')
  ) {
    itemKinds.push('hotel')
  }
  if (
    input.plan.action === 'search_packages' ||
    input.plan.searchRequests.some((s) => s.kind === 'packages')
  ) {
    itemKinds.push('package')
  }

  const bookingSessionDraft =
    itemKinds.length > 0
      ? {
          status: 'draft' as const,
          currency: memory.currency ?? memory.budget.currency,
          itemKinds,
        }
      : null

  const itinerarySeed = memory.destination
    ? {
        destination: memory.destination,
        durationDays: memory.travelDates.durationDays,
        travelers: memory.travelers.count,
      }
    : null

  return {
    searchDraft,
    passengerCounts,
    passengerSlotIds,
    bookingSessionDraft,
    itinerarySeed,
  }
}

function toPassengerCounts(memory: ConversationMemory): TravellerCounts | null {
  const adults = memory.travelers.adults
  const children = memory.travelers.children ?? 0
  const infants = memory.travelers.infants ?? 0
  if (adults != null || memory.travelers.count != null) {
    const a = adults ?? memory.travelers.count ?? 0
    const total = a + children + infants
    if (total < 1) return null
    return { adults: a, children, infants, total }
  }
  return null
}

function toSearchDraft(
  memory: ConversationMemory,
  missingFields: BrainMemorySlot[],
  ready: boolean,
): TravelSearchDraft | null {
  if (!memory.destination) return null

  const adults = memory.travelers.adults ?? memory.travelers.count ?? 1
  const children = memory.travelers.children ?? 0
  const infants = memory.travelers.infants ?? 0
  const durationDays =
    memory.travelDates.durationDays ??
    (memory.travelDates.startDate && memory.travelDates.endDate
      ? Math.max(
          1,
          Math.round(
            (Date.parse(memory.travelDates.endDate) -
              Date.parse(memory.travelDates.startDate)) /
              86_400_000,
          ),
        )
      : 0)

  const cabin =
    memory.cabinClass === 'premium_economy'
      ? 'premium-economy'
      : memory.cabinClass ?? ''

  return {
    destination: memory.destination,
    departureCity: memory.origin ?? '',
    departureDate: memory.travelDates.startDate ?? '',
    returnDate: memory.travelDates.endDate ?? '',
    durationDays,
    adults,
    children,
    infants,
    preferredCabin: cabin,
    preferredAirlines: [...memory.airlinePreferences],
    preferredHotels: [...memory.hotelPreferences],
    budgetAmount: memory.budget.amount ?? 0,
    budgetCurrency: memory.currency ?? memory.budget.currency ?? 'SAR',
    hotelRequired: memory.hotelRequirement,
    flexibleDates: memory.travelDates.flexible,
    readyForSearch: ready,
    missingFields: [...missingFields],
  }
}
