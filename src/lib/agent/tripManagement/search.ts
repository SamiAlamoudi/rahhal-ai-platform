/**
 * Sprint 62 — trip search, filter, and sort.
 */

import { isActiveTripStatus } from './lifecycle'
import type {
  ManagedTrip,
  TripFilterMode,
  TripSearchQuery,
  TripSortMode,
} from './types'

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

function includesDate(trip: ManagedTrip, date: string): boolean {
  const d = date.slice(0, 10)
  const candidates = [
    trip.departure,
    trip.return,
    ...trip.flights.flatMap((f) => [f.departureAt, f.arrivalAt]),
    ...trip.hotels.flatMap((h) => [h.checkIn, h.checkOut]),
  ]
  return candidates.some((c) => c != null && c.slice(0, 10) === d)
}

export function matchesTripSearch(trip: ManagedTrip, query: TripSearchQuery): boolean {
  if (query.userId && trip.userId !== query.userId) return false
  if (query.status && trip.bookingStatus !== query.status) return false
  if (query.destination) {
    const q = norm(query.destination)
    const hit =
      norm(trip.destination).includes(q)
      || trip.flights.some((f) => norm(f.destination).includes(q))
      || trip.hotels.some((h) => norm(h.hotelName).includes(q))
    if (!hit) return false
  }
  if (query.traveler) {
    const q = norm(query.traveler)
    const hit = trip.travelers.some((t) =>
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(q)
      || norm(t.firstName).includes(q)
      || norm(t.lastName).includes(q),
    )
    if (!hit) return false
  }
  if (query.bookingReference) {
    const q = norm(query.bookingReference)
    const hit =
      trip.bookingReferences.some((r) => norm(r).includes(q))
      || trip.bookings.some(
        (b) =>
          norm(b.confirmation).includes(q)
          || norm(b.providerBookingId).includes(q)
          || norm(b.hotelConfirmation).includes(q)
          || norm(b.bookingId).includes(q),
      )
    if (!hit) return false
  }
  if (query.pnr) {
    const q = norm(query.pnr)
    const hit =
      trip.pnrs.some((p) => norm(p).includes(q))
      || trip.flights.some((f) => norm(f.pnr).includes(q))
      || trip.bookings.some((b) => norm(b.pnr).includes(q))
    if (!hit) return false
  }
  if (query.hotel) {
    const q = norm(query.hotel)
    const hit = trip.hotels.some(
      (h) =>
        norm(h.hotelName).includes(q)
        || norm(h.confirmation).includes(q)
        || norm(h.reservationId).includes(q),
    )
    if (!hit) return false
  }
  if (query.date && !includesDate(trip, query.date)) return false
  return true
}

export function searchTrips(trips: ManagedTrip[], query: TripSearchQuery): ManagedTrip[] {
  return trips.filter((t) => matchesTripSearch(t, query))
}

function departureMs(trip: ManagedTrip, nowMs: number): number {
  if (trip.departure) {
    const t = Date.parse(trip.departure)
    if (!Number.isNaN(t)) return t
  }
  const flight = trip.flights.find((f) => f.departureAt)
  if (flight?.departureAt) {
    const t = Date.parse(flight.departureAt)
    if (!Number.isNaN(t)) return t
  }
  const hotel = trip.hotels.find((h) => h.checkIn)
  if (hotel?.checkIn) {
    const t = Date.parse(hotel.checkIn)
    if (!Number.isNaN(t)) return t
  }
  return nowMs + 1e15
}

export function filterTrips(
  trips: ManagedTrip[],
  mode: TripFilterMode,
  now?: () => number,
): ManagedTrip[] {
  const nowMs = (now ?? Date.now)()
  switch (mode) {
    case 'Active':
      return trips.filter((t) => isActiveTripStatus(t.bookingStatus))
    case 'Past':
      return trips.filter((t) => {
        if (t.bookingStatus === 'Completed') return true
        const dep = departureMs(t, nowMs)
        return dep < nowMs && t.bookingStatus !== 'Cancelled' && t.bookingStatus !== 'Refunded'
      })
    case 'Cancelled':
      return trips.filter((t) => t.bookingStatus === 'Cancelled')
    case 'Refunded':
      return trips.filter(
        (t) => t.bookingStatus === 'Refunded' || t.bookingStatus === 'RefundPending',
      )
    case 'Business':
      return trips.filter((t) => t.purpose === 'business')
    case 'Leisure':
      return trips.filter((t) => t.purpose === 'leisure')
    default:
      return trips
  }
}

export function sortTrips(
  trips: ManagedTrip[],
  mode: TripSortMode,
  now?: () => number,
): ManagedTrip[] {
  const nowMs = (now ?? Date.now)()
  const copy = [...trips]
  switch (mode) {
    case 'Upcoming':
      return copy
        .filter((t) => {
          if (t.bookingStatus === 'Cancelled' || t.bookingStatus === 'Refunded') return false
          if (t.bookingStatus === 'Completed') return false
          return departureMs(t, nowMs) >= nowMs - 86400000
        })
        .sort((a, b) => departureMs(a, nowMs) - departureMs(b, nowMs))
    case 'Recent':
      return copy.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      )
    case 'Completed':
      return copy
        .filter((t) => t.bookingStatus === 'Completed')
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    case 'Cancelled':
      return copy
        .filter((t) => t.bookingStatus === 'Cancelled' || t.bookingStatus === 'Refunded')
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    default:
      return copy
  }
}
