/**
 * Select Flight → Booking Session (Sprint 11 → Sprint 12 ready).
 * Stores selected itinerary, pricing, traveler placeholders, booking payload.
 */

import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { TravelSearchRequest } from '../../utils/travelSearchRequest'
import {
  getBookingOrchestrator,
  persistBookingSession,
  toBookingSelectedItem,
  type BookingSession,
} from '../booking'
import { toFlightResultViewModel } from './viewModel'

export interface CreateFlightBookingSessionInput {
  option: NormalizedTravelOption
  searchRequest: TravelSearchRequest
  userId: string
  travelSessionId?: string | null
  /** Optional priced/booking-ready blob from Sprint 10 (opaque to UI). */
  bookingPayload?: Record<string, unknown> | null
}

export interface CreateFlightBookingSessionResult {
  session: BookingSession
  selectedItemId: string
}

function travelerPlaceholder(searchRequest: TravelSearchRequest): string {
  const { adults, children, infants, total } = searchRequest.travelers
  return `adults:${adults}|children:${children}|infants:${infants}|total:${total}`
}

export async function createSessionFromFlightSelection(
  input: CreateFlightBookingSessionInput,
): Promise<CreateFlightBookingSessionResult> {
  const view = toFlightResultViewModel(input.option)
  const selected = toBookingSelectedItem(input.option)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const orchestrator = getBookingOrchestrator()

  const session = orchestrator.createBookingSession({
    userId: input.userId,
    travelSessionId: input.travelSessionId ?? null,
    currency: input.option.currency || input.searchRequest.budgetCurrency || 'SAR',
    expiresAt,
  })

  const added = orchestrator.addBookingItem(session.id, {
    type: 'flight',
    providerId: input.option.providerIds[0] || 'flight-provider',
    providerName: selected.providerName,
    providerOfferId: input.option.id,
    title: input.option.title,
    price: input.option.price,
    currency: input.option.currency,
    bookingUrl: selected.bookingUrl,
    expiresAt: selected.expiresAt,
    travelerSummary: travelerPlaceholder(input.searchRequest),
    metadata: {
      sprint: 11,
      selectedItinerary: {
        origin: view.origin,
        destination: view.destination,
        departureTime: view.departureTime,
        arrivalTime: view.arrivalTime,
        durationMinutes: view.durationMinutes,
        stops: view.stops,
        cabin: view.cabin,
        segments: view.segments,
        airline: view.airlineName,
      },
      pricing: {
        amount: view.price,
        currency: view.currency,
        originalPrice: input.option.attributes.originalPrice ?? null,
      },
      travellersPlaceholder: {
        adults: input.searchRequest.travelers.adults,
        children: input.searchRequest.travelers.children,
        infants: input.searchRequest.travelers.infants,
        total: input.searchRequest.travelers.total,
      },
      bookingPayload: input.bookingPayload ?? {
        kind: 'flight_selection',
        offerId: input.option.id,
        bookingUrl: selected.bookingUrl,
        attributes: input.option.attributes,
      },
      refundable: view.refundable,
      baggageIncluded: view.baggageIncluded,
    },
  })

  if (!added.session) {
    throw new Error(added.error || 'Failed to add flight to booking session')
  }

  await persistBookingSession(added.session)

  const itemId = added.session.items[0]?.id ?? ''
  return { session: added.session, selectedItemId: itemId }
}
