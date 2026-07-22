/**
 * Sprint 96 — Recommendation Explanation Engine (natural language, no black box).
 */

import type { ConciergeExplanation, ConciergeOfferFacts, ConciergeTripFacts } from './types'

function money(amount: number | null | undefined, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return 'your budget'
  return `${Math.round(amount)} ${currency}`
}

export function buildConciergeExplanation(input: {
  trip: ConciergeTripFacts
  offers?: ConciergeOfferFacts
}): ConciergeExplanation {
  const trip = input.trip
  const offers = input.offers ?? {}
  const currency = (trip.currency || offers.flights?.[0]?.currency || 'SAR').toUpperCase()
  const destination = trip.destination?.trim() || 'this destination'
  const origin = trip.origin?.trim() || 'your city'
  const flight = offers.flights?.[0]
  const hotel = offers.hotels?.[0]
  const pkg = offers.packages?.[0]
  const interests = (trip.interests ?? []).filter(Boolean).slice(0, 3)

  const whyDestination = trip.mission
    ? `I chose ${destination} because it aligns with your trip mission: ${trip.mission}.`
    : interests.length > 0
      ? `I chose ${destination} because it matches your interests (${interests.join(', ')}) while staying reachable from ${origin}.`
      : `I chose ${destination} as a strong fit from ${origin} given your dates${trip.budgetAmount != null ? ` and budget of ${money(trip.budgetAmount, currency)}` : ''}.`

  const whyFlights = flight
    ? [
        `These flights stand out`,
        flight.airline ? `on ${flight.airline}` : null,
        flight.stops == null ? null : flight.stops === 0 ? 'as a direct option' : `with ${flight.stops} stop(s)`,
        flight.durationMinutes != null ? `in about ${Math.round(flight.durationMinutes / 60)}h` : null,
        flight.price != null ? `at roughly ${money(flight.price, flight.currency || currency)}` : null,
        flight.cabin ? `in ${flight.cabin}` : null,
      ].filter(Boolean).join(' ') + '.'
    : `I prioritized reliable flight options between ${origin} and ${destination} that balance duration and price.`

  const whyHotel = hotel
    ? [
        `This hotel`,
        hotel.name ? `(${hotel.name})` : null,
        hotel.stars != null ? `at ${hotel.stars}★` : null,
        hotel.rating != null ? `with guest rating ${hotel.rating}` : null,
        hotel.price != null ? `around ${money(hotel.price, hotel.currency || currency)}` : null,
        'fits your stay quality and location needs.',
      ].filter(Boolean).join(' ')
    : `I selected a hotel stay that balances comfort and location for ${destination}.`

  const whyPackage = pkg
    ? `This package${pkg.title ? ` (“${pkg.title}”)` : ''} combines flight and hotel into one coherent plan${pkg.totalPrice != null ? ` near ${money(pkg.totalPrice, pkg.currency || currency)}` : ''}${pkg.explanation ? ` — ${pkg.explanation}` : '.'}`
    : offers.decision?.explanation
      ? `This combination was preferred by the decision layer: ${offers.decision.explanation}`
      : `I assembled a balanced package so flights, hotel, and timing work together rather than as isolated deals.`

  const whyTiming = offers.priceTimingNote
    ? `Timing recommendation: ${offers.priceTimingNote}`
    : trip.startDate && trip.endDate
      ? `These dates (${trip.startDate} → ${trip.endDate}${trip.durationDays != null ? `, ~${trip.durationDays} days` : ''}) give a practical window for ${destination} without rushing transfers.`
      : `I optimized timing for a smoother arrival/departure rhythm and fewer tight connections.`

  const summary = [
    `For ${destination}`,
    trip.budgetAmount != null ? `within ${money(trip.budgetAmount, currency)}` : null,
    'I recommend this plan because destination fit, flights, hotel quality, package coherence, and timing all reinforce each other.',
  ].filter(Boolean).join(' ')

  return {
    whyDestination,
    whyFlights,
    whyHotel,
    whyPackage,
    whyTiming,
    summary,
  }
}
