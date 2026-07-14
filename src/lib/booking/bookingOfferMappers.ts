import type { FlightOffer } from '../../utils/contracts/models/flight'
import type { HotelOffer } from '../../utils/contracts/models/hotel'
import type { TripTravelSummary } from '../../utils/tripPlanner'
import type { AddBookingItemInput } from './bookingOrchestrator'

export function formatTravelerSummary(summary: TripTravelSummary): string {
  const parts: string[] = []
  if (summary.travelers.adults > 0) parts.push(`${summary.travelers.adults} adults`)
  if (summary.travelers.children > 0) parts.push(`${summary.travelers.children} children`)
  if (summary.travelers.infants > 0) parts.push(`${summary.travelers.infants} infants`)
  return parts.join(', ') || '1 adult'
}

function providerDisplayName(providerId: string, fallback: string): string {
  if (providerId.includes('amadeus')) return 'Amadeus'
  if (providerId.includes('booking')) return 'Booking.com'
  if (providerId.includes('mock-flight')) return 'Mock Flight Provider'
  if (providerId.includes('mock-hotel')) return 'Mock Hotel Provider'
  return fallback
}

export function flightOfferToBookingItemInput(
  offer: FlightOffer,
  summary: TripTravelSummary,
): AddBookingItemInput {
  const first = offer.itinerary.segments[0]
  const last = offer.itinerary.segments[offer.itinerary.segments.length - 1]
  return {
    type: 'flight',
    providerId: offer.providerId,
    providerName: providerDisplayName(offer.providerId, 'Flight Provider'),
    providerOfferId: offer.id,
    title: offer.title,
    price: offer.price,
    currency: offer.currency || summary.currency,
    bookingUrl: '',
    expiresAt: null,
    travelerSummary: formatTravelerSummary(summary),
    metadata: {
      origin: summary.origin,
      destination: summary.destination,
      departureDate: summary.departureDate,
      returnDate: summary.returnDate,
      nights: summary.nights,
      flightOrigin: first?.origin ?? null,
      flightDestination: last?.destination ?? null,
      stops: offer.itinerary.stops,
      carrier: first?.carrier ?? null,
      cancellationPolicy: offer.cancellationPolicy,
      offerSnapshot: offer,
    },
  }
}

export function hotelOfferToBookingItemInput(
  offer: HotelOffer,
  summary: TripTravelSummary,
): AddBookingItemInput {
  return {
    type: 'hotel',
    providerId: offer.providerId,
    providerName: providerDisplayName(offer.providerId, 'Hotel Provider'),
    providerOfferId: offer.id,
    title: offer.title,
    price: offer.price,
    currency: offer.currency || summary.currency,
    bookingUrl: '',
    expiresAt: null,
    travelerSummary: formatTravelerSummary(summary),
    metadata: {
      origin: summary.origin,
      destination: summary.destination,
      departureDate: summary.departureDate,
      returnDate: summary.returnDate,
      checkIn: offer.checkIn || summary.departureDate,
      checkOut: offer.checkOut || summary.returnDate,
      nights: summary.nights,
      location: offer.location,
      hotelStars: offer.hotelStars,
      freeCancellation: offer.freeCancellation,
      breakfastIncluded: offer.breakfastIncluded,
      offerSnapshot: offer,
    },
  }
}
