/**
 * Sprint 35 — ItineraryGenerator for post-booking My Trip.
 * Does not replace payment/itineraryGenerator or smartItinerary engines.
 */

import type { CreatePostBookingTripInput, GeneratedItinerary } from './postBookingTypes'

export class ItineraryGenerator {
  generate(input: CreatePostBookingTripInput, tripId: string): GeneratedItinerary {
    const destination = input.destination
    const hotel = input.hotelName ?? 'Your hotel'
    const days = [
      {
        day: 1,
        title: `Arrive in ${destination}`,
        items: [
          input.origin
            ? `Flight from ${input.origin} to ${destination}`
            : `Arrive in ${destination}`,
          ...(input.references.flightConfirmation
            ? [`E-ticket ${input.references.flightConfirmation}`]
            : []),
          `Check in at ${hotel}`,
        ],
      },
      {
        day: 2,
        title: `Explore ${destination}`,
        items: ['Morning free time', 'Local experiences', 'Dinner near hotel'],
      },
      {
        day: 3,
        title: 'Departure day',
        items: [
          `Check out from ${hotel}`,
          ...(input.references.hotelConfirmation
            ? [`Voucher ${input.references.hotelConfirmation}`]
            : []),
          'Airport transfer / departure',
        ],
      },
    ]

    const summaryText = [
      `Trip to ${destination}`,
      `Booking ${input.references.bookingReference}`,
      input.references.flightConfirmation
        ? `Flight confirmation ${input.references.flightConfirmation}`
        : null,
      input.references.hotelConfirmation
        ? `Hotel confirmation ${input.references.hotelConfirmation}`
        : null,
      `Total paid ${input.totalPaid} ${input.currency}`,
    ]
      .filter(Boolean)
      .join(' · ')

    return {
      itineraryId: `itin_${Math.random().toString(36).slice(2, 10)}`,
      tripId,
      title: input.title?.trim() || `${destination} trip`,
      destination,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      days,
      summaryText,
      generatedAt: new Date().toISOString(),
    }
  }
}

export function createItineraryGenerator(): ItineraryGenerator {
  return new ItineraryGenerator()
}
