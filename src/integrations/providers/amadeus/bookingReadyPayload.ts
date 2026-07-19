/**
 * Booking-ready payload for Amadeus Flight Offers.
 *
 * Carries a priced offer suitable for a future Flight Create Orders call.
 * Explicitly does NOT include payment instruments or PSP fields.
 */

import type { FlightOffer } from '../../../utils/contracts/models/flight'
import type { AmadeusFlightOffer } from './amadeusFlightApiClient'
import { buildAmadeusSandboxBookingUrl } from './amadeusSandbox'

export interface BookingReadyTravelerSlot {
  /** Amadeus traveler id (1-based string). */
  id: string
  travelerType: 'ADULT' | 'CHILD' | 'SEATED_INFANT'
}

export interface AmadeusBookingReadyPayload {
  /** Stable Rahhal contract marker. */
  kind: 'amadeus_flight_booking_ready'
  version: 1
  /** Provider adapter id. */
  providerId: string
  /** Offer id from search / pricing. */
  offerId: string
  /** Normalized UI offer (priced when available). */
  offer: FlightOffer
  /** Raw priced Amadeus flight-offer for Create Orders (no payment). */
  pricedFlightOffer: AmadeusFlightOffer
  /** Traveler slots derived from search — names filled later at booking. */
  travelerSlots: BookingReadyTravelerSlot[]
  /** Safe handoff URL for redirect booking mode. */
  bookingUrl: string
  /** ISO timestamp when the payload was built. */
  builtAt: string
  /** Payment intentionally omitted — Sprint 10 scope. */
  payment: null
}

export function buildTravelerSlots(input: {
  adults: number
  children?: number
  infants?: number
}): BookingReadyTravelerSlot[] {
  const slots: BookingReadyTravelerSlot[] = []
  let nextId = 1
  for (let i = 0; i < Math.max(1, input.adults); i += 1) {
    slots.push({ id: String(nextId++), travelerType: 'ADULT' })
  }
  for (let i = 0; i < Math.max(0, input.children ?? 0); i += 1) {
    slots.push({ id: String(nextId++), travelerType: 'CHILD' })
  }
  for (let i = 0; i < Math.max(0, input.infants ?? 0); i += 1) {
    slots.push({ id: String(nextId++), travelerType: 'SEATED_INFANT' })
  }
  return slots
}

export function buildAmadeusBookingReadyPayload(input: {
  providerId: string
  pricedFlightOffer: AmadeusFlightOffer
  offer: FlightOffer
  adults: number
  children?: number
  infants?: number
  host?: string | null
}): AmadeusBookingReadyPayload {
  return {
    kind: 'amadeus_flight_booking_ready',
    version: 1,
    providerId: input.providerId,
    offerId: input.pricedFlightOffer.id,
    offer: input.offer,
    pricedFlightOffer: input.pricedFlightOffer,
    travelerSlots: buildTravelerSlots({
      adults: input.adults,
      children: input.children,
      infants: input.infants,
    }),
    bookingUrl: input.offer.bookingUrl
      ?? buildAmadeusSandboxBookingUrl(input.pricedFlightOffer.id, { host: input.host }),
    builtAt: new Date().toISOString(),
    payment: null,
  }
}
