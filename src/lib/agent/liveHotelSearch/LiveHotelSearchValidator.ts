/**
 * Sprint 109 — validate live hotel search criteria.
 */

import type { LiveHotelSearchCriteria } from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY_RE = /^[A-Za-z]{3}$/

export interface LiveHotelSearchValidation {
  ok: boolean
  errors: string[]
  normalized: LiveHotelSearchCriteria | null
}

function parseDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  const [y, m, day] = value.split('-').map(Number)
  if (
    d.getUTCFullYear() !== y
    || d.getUTCMonth() + 1 !== m
    || d.getUTCDate() !== day
  ) {
    return null
  }
  return d
}

export function validateLiveHotelSearchCriteria(
  criteria: LiveHotelSearchCriteria,
): LiveHotelSearchValidation {
  const errors: string[] = []

  const destination = (criteria.destination ?? '').trim()
  const checkInDate = (criteria.checkInDate ?? '').trim()
  const checkOutDate = (criteria.checkOutDate ?? '').trim()
  const currency = (criteria.currency ?? 'SAR').trim().toUpperCase()

  if (!destination) {
    errors.push('destination is required')
  } else if (destination.length < 2) {
    errors.push('destination is invalid')
  }

  if (!checkInDate) errors.push('checkInDate is required')
  if (!checkOutDate) errors.push('checkOutDate is required')

  const checkIn = checkInDate ? parseDate(checkInDate) : null
  const checkOut = checkOutDate ? parseDate(checkOutDate) : null
  if (checkInDate && !checkIn) errors.push('checkInDate must be a valid YYYY-MM-DD date')
  if (checkOutDate && !checkOut) errors.push('checkOutDate must be a valid YYYY-MM-DD date')
  if (checkIn && checkOut && checkOut.getTime() <= checkIn.getTime()) {
    errors.push('checkOutDate must be after checkInDate')
  }

  const adults = criteria.adults == null ? 1 : Number(criteria.adults)
  const children = criteria.children == null ? 0 : Number(criteria.children)
  const rooms = criteria.rooms == null ? 1 : Number(criteria.rooms)

  if (!Number.isFinite(adults) || !Number.isInteger(adults) || adults < 1 || adults > 9) {
    errors.push('adults must be an integer between 1 and 9')
  }
  if (!Number.isFinite(children) || !Number.isInteger(children) || children < 0 || children > 8) {
    errors.push('children must be an integer between 0 and 8')
  }
  if (!Number.isFinite(rooms) || !Number.isInteger(rooms) || rooms < 1 || rooms > 9) {
    errors.push('rooms must be an integer between 1 and 9')
  }
  if (
    Number.isFinite(adults)
    && Number.isFinite(rooms)
    && adults < rooms
  ) {
    errors.push('adults must be at least equal to rooms')
  }
  if (
    Number.isFinite(adults)
    && Number.isFinite(children)
    && adults + children > 9
  ) {
    errors.push('total travelers (adults + children) must be at most 9')
  }

  if (!CURRENCY_RE.test(currency)) {
    errors.push('currency must be a 3-letter ISO code')
  }

  let maxResults: number | undefined
  if (criteria.maxResults != null) {
    const max = Number(criteria.maxResults)
    if (!Number.isFinite(max) || !Number.isInteger(max) || max < 1 || max > 50) {
      errors.push('maxResults must be an integer between 1 and 50')
    } else {
      maxResults = max
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, normalized: null }
  }

  return {
    ok: true,
    errors: [],
    normalized: {
      destination,
      checkInDate,
      checkOutDate,
      adults,
      children,
      rooms,
      currency,
      maxResults: maxResults ?? criteria.maxResults ?? 20,
      latitude: criteria.latitude ?? null,
      longitude: criteria.longitude ?? null,
      timeoutMs: criteria.timeoutMs,
      signal: criteria.signal,
    },
  }
}
