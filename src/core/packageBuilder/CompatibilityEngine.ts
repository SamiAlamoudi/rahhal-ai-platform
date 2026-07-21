/**
 * Sprint 83 — reject incompatible package combinations.
 */

import type {
  NormalizedActivityOffer,
  NormalizedFlightOffer,
  NormalizedHotelOffer,
  NormalizedTransferOffer,
  PackageCandidate,
} from './PackageCandidate'

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

/** Hotel check-in typically closes ~23:00 local; use hour from ISO if present. */
function hotelCheckInClosesAt(checkIn: string | null): number | null {
  if (!checkIn) return null
  const d = new Date(checkIn)
  if (Number.isNaN(d.getTime())) return null
  // If only a date, assume 23:00 UTC close.
  if (checkIn.length <= 10) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 0, 0)
  }
  return d.getTime()
}

export function checkFlightHotelCompatibility(
  flight: NormalizedFlightOffer,
  hotel: NormalizedHotelOffer,
): string[] {
  const reasons: string[] = []

  if (
    flight.destination
    && hotel.destination
    && flight.destination.toLowerCase() !== hotel.destination.toLowerCase()
  ) {
    reasons.push('invalid destination combination')
  }

  const arrival = parseTime(flight.arrivalAt)
  const checkInClose = hotelCheckInClosesAt(hotel.checkIn)
  if (arrival != null && checkInClose != null && arrival > checkInClose) {
    reasons.push('arrival after hotel check-in closes')
  }

  const hotelStart = parseTime(hotel.checkIn)
  const hotelEnd = parseTime(hotel.checkOut)
  if (hotelStart != null && hotelEnd != null && hotelEnd <= hotelStart) {
    reasons.push('overlapping reservations')
  }

  return reasons
}

export function checkTransferCompatibility(
  flight: NormalizedFlightOffer,
  hotel: NormalizedHotelOffer,
  transfer: NormalizedTransferOffer | null,
): string[] {
  if (!transfer) return []
  const reasons: string[] = []

  if (
    transfer.destination
    && hotel.destination
    && transfer.destination.toLowerCase() !== hotel.destination.toLowerCase()
  ) {
    reasons.push('airport transfer mismatch')
  }

  const arrival = parseTime(flight.arrivalAt)
  const from = parseTime(transfer.availableFrom)
  const to = parseTime(transfer.availableTo)
  if (arrival != null && from != null && to != null && (arrival < from || arrival > to)) {
    reasons.push('transfer unavailable')
  }

  return reasons
}

export function checkActivityCompatibility(
  hotel: NormalizedHotelOffer,
  activity: NormalizedActivityOffer,
): string[] {
  const reasons: string[] = []
  const stayStart = parseTime(hotel.checkIn)
  const stayEnd = parseTime(hotel.checkOut)
  const actStart = parseTime(activity.startAt)
  const actEnd = parseTime(activity.endAt)

  if (
    activity.destination
    && hotel.destination
    && activity.destination.toLowerCase() !== hotel.destination.toLowerCase()
  ) {
    reasons.push('invalid destination combination')
  }

  if (stayStart != null && stayEnd != null && actStart != null) {
    if (actStart < stayStart || actStart > stayEnd) {
      reasons.push('activity outside stay')
    }
  }
  if (stayStart != null && stayEnd != null && actEnd != null) {
    if (actEnd < stayStart || actEnd > stayEnd) {
      reasons.push('activity outside stay')
    }
  }

  // Activity overlapping itself badly
  if (actStart != null && actEnd != null && actEnd < actStart) {
    reasons.push('overlapping reservations')
  }

  return reasons
}

export function checkFlightMismatch(
  flight: NormalizedFlightOffer,
  expectedDestination?: string | null,
): string[] {
  if (!expectedDestination || !flight.destination) return []
  if (flight.destination.toLowerCase() !== expectedDestination.toLowerCase()) {
    return ['flight mismatch']
  }
  return []
}

export function evaluateCompatibility(input: {
  flight: NormalizedFlightOffer
  hotel: NormalizedHotelOffer
  transfer?: NormalizedTransferOffer | null
  activities?: NormalizedActivityOffer[]
  expectedDestination?: string | null
}): { compatible: boolean; rejectionReasons: string[] } {
  const reasons = [
    ...checkFlightMismatch(input.flight, input.expectedDestination),
    ...checkFlightHotelCompatibility(input.flight, input.hotel),
    ...checkTransferCompatibility(input.flight, input.hotel, input.transfer ?? null),
  ]
  for (const activity of input.activities ?? []) {
    reasons.push(...checkActivityCompatibility(input.hotel, activity))
  }
  const unique = [...new Set(reasons)]
  return { compatible: unique.length === 0, rejectionReasons: unique }
}

export function isCompatiblePackage(pkg: PackageCandidate): boolean {
  return pkg.compatible && pkg.rejectionReasons.length === 0
}
