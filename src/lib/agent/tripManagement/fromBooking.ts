/**
 * Sprint 62 — build trip fields from UnifiedBooking (Booking Execution output).
 */

import type { UnifiedBooking } from '../bookingExecution/types'
import {
  aggregateTripStatus,
  mapBookingLifecycleToTripStatus,
} from './lifecycle'
import type {
  TripBookingRef,
  TripFlightSegment,
  TripHotelStay,
  TripTraveler,
} from './types'

export function travelersFromBookings(bookings: UnifiedBooking[]): TripTraveler[] {
  const seen = new Set<string>()
  const out: TripTraveler[] = []
  for (const b of bookings) {
    for (const t of b.travelerInfo) {
      const key = `${t.firstName}|${t.lastName}|${t.email ?? ''}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email ?? null,
        phone: t.phone ?? null,
      })
    }
  }
  return out
}

export function flightFromBooking(b: UnifiedBooking): TripFlightSegment | null {
  if (b.domain !== 'flights') return null
  return {
    bookingId: b.id,
    provider: b.provider,
    confirmation: b.confirmation,
    pnr: b.pnr,
    ticketNumbers: [...b.ticketNumbers],
    origin: null,
    destination: null,
    departureAt: null,
    arrivalAt: null,
    status: mapBookingLifecycleToTripStatus(b.status),
  }
}

export function hotelFromBooking(b: UnifiedBooking): TripHotelStay | null {
  if (b.domain !== 'hotels') return null
  return {
    bookingId: b.id,
    provider: b.provider,
    hotelName: null,
    confirmation: b.hotelConfirmation ?? b.confirmation,
    reservationId: b.reservationId,
    roomType: b.roomType,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    guestNames: [...b.guestNames],
    status: mapBookingLifecycleToTripStatus(b.status),
  }
}

export function bookingRefFromUnified(b: UnifiedBooking): TripBookingRef {
  return {
    bookingId: b.id,
    domain: b.domain,
    provider: b.provider,
    confirmation: b.confirmation,
    pnr: b.pnr,
    providerBookingId: b.providerBookingId,
    hotelConfirmation: b.hotelConfirmation,
    status: mapBookingLifecycleToTripStatus(b.status),
  }
}

export function collectBookingReferences(bookings: UnifiedBooking[]): string[] {
  const refs = new Set<string>()
  for (const b of bookings) {
    if (b.confirmation) refs.add(b.confirmation)
    if (b.providerBookingId) refs.add(b.providerBookingId)
    if (b.hotelConfirmation) refs.add(b.hotelConfirmation)
    if (b.reservationId) refs.add(b.reservationId)
    refs.add(b.id)
  }
  return [...refs]
}

export function collectPnrs(bookings: UnifiedBooking[]): string[] {
  const pnrs = new Set<string>()
  for (const b of bookings) {
    if (b.pnr) pnrs.add(b.pnr)
  }
  return [...pnrs]
}

export function deriveTripStatusFromBookings(bookings: UnifiedBooking[]) {
  return aggregateTripStatus(bookings.map((b) => mapBookingLifecycleToTripStatus(b.status)))
}

export function inferOriginDestination(bookings: UnifiedBooking[]): {
  origin: string
  destination: string
} {
  const flight = bookings.find((b) => b.domain === 'flights')
  const hotel = bookings.find((b) => b.domain === 'hotels')
  // Offer title sometimes carries route; without raw offer we leave empty for caller override.
  void flight
  void hotel
  return { origin: '', destination: '' }
}
