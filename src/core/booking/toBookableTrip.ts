/**
 * Sprint 93 ↔ 94 bridge — adapt Unified Trip into BookableTrip.
 * Additive only: Booking Orchestrator still accepts plain BookableTrip.
 */

import type { Trip } from '../trip/types'
import type { BookableTrip } from './types'

/** Structural Trip-like input (Unified Trip or BookableTrip). */
export type TripLikeInput = Trip | BookableTrip

function isUnifiedTrip(trip: TripLikeInput): trip is Trip {
  return (
    typeof (trip as Trip).version === 'string'
    && Array.isArray((trip as Trip).activities)
    && (trip as Trip).summary != null
    && (trip as Trip).confidence != null
  )
}

/**
 * Normalize a Unified Trip (or existing BookableTrip) into BookableTrip.
 * Preserves booking-required fields; drops presentation-only Trip extras.
 */
export function toBookableTrip(trip: TripLikeInput): BookableTrip {
  if (!isUnifiedTrip(trip)) {
    return trip
  }

  return {
    id: trip.id,
    destination: trip.destination,
    origin: trip.origin,
    currency: trip.currency,
    budget: trip.budget,
    valid: trip.valid,
    validationErrors: trip.validationErrors,
    dates: {
      start: trip.dates.start,
      end: trip.dates.end,
    },
    travelers: {
      adults: trip.travelers.adults,
      children: trip.travelers.children,
      total: trip.travelers.total,
    },
    flights: trip.flights.map((f) => ({
      id: f.id,
      airline: f.airline,
      origin: f.origin,
      destination: f.destination,
      departureAt: f.departureAt,
      arrivalAt: f.arrivalAt,
      price: f.price,
      currency: f.currency,
      providerId: f.providerId,
      confidence: f.confidence,
    })),
    hotel: trip.hotel
      ? {
          id: trip.hotel.id,
          name: trip.hotel.name,
          checkIn: trip.hotel.checkIn,
          checkOut: trip.hotel.checkOut,
          price: trip.hotel.price,
          currency: trip.hotel.currency,
          providerId: trip.hotel.providerId,
        }
      : null,
    transfers: trip.transfers.map((t) => ({
      id: t.id,
      title: t.title,
      price: t.price,
      currency: t.currency,
      providerId: t.providerId,
    })),
    insurance: trip.insurance
      ? {
          id: trip.insurance.id,
          title: trip.insurance.title,
          price: trip.insurance.price,
          currency: trip.insurance.currency,
          providerId: trip.insurance.providerId,
        }
      : null,
    pricingSummary: {
      total: trip.pricingSummary.total,
      currency: trip.pricingSummary.currency,
      flightCost: trip.pricingSummary.flightCost,
      hotelCost: trip.pricingSummary.hotelCost,
    },
  }
}
