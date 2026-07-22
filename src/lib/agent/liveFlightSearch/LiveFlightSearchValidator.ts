/**
 * Sprint 105 — validate live flight search criteria (IATA, dates, travelers).
 */

import type { LiveFlightSearchCriteria } from './types'

const IATA_RE = /^[A-Za-z]{3}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY_RE = /^[A-Za-z]{3}$/

const ALLOWED_CABINS = new Set([
  'economy',
  'premium_economy',
  'premium-economy',
  'premiumeconomy',
  'business',
  'first',
  'economy_premium',
])

export interface LiveFlightSearchValidation {
  ok: boolean
  errors: string[]
  normalized: LiveFlightSearchCriteria | null
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

export function validateLiveFlightSearchCriteria(
  criteria: LiveFlightSearchCriteria,
): LiveFlightSearchValidation {
  const errors: string[] = []

  const origin = (criteria.origin ?? '').trim().toUpperCase()
  const destination = (criteria.destination ?? '').trim().toUpperCase()
  const departureDate = (criteria.departureDate ?? '').trim()
  const returnDateRaw = criteria.returnDate?.trim() || null
  const currency = (criteria.currency ?? 'SAR').trim().toUpperCase()

  if (!origin) errors.push('origin is required')
  else if (!IATA_RE.test(origin)) errors.push('origin must be a 3-letter IATA code')

  if (!destination) errors.push('destination is required')
  else if (!IATA_RE.test(destination)) errors.push('destination must be a 3-letter IATA code')

  if (origin && destination && origin === destination) {
    errors.push('origin and destination must differ')
  }

  if (!departureDate) errors.push('departureDate is required')
  const dep = departureDate ? parseDate(departureDate) : null
  if (departureDate && !dep) errors.push('departureDate must be a valid YYYY-MM-DD date')

  let returnDate: string | null = null
  if (returnDateRaw) {
    const ret = parseDate(returnDateRaw)
    if (!ret) errors.push('returnDate must be a valid YYYY-MM-DD date')
    else if (dep && ret.getTime() < dep.getTime()) {
      errors.push('returnDate must be on or after departureDate')
    } else {
      returnDate = returnDateRaw
    }
  }

  const adults = criteria.adults == null ? 1 : Number(criteria.adults)
  const children = criteria.children == null ? 0 : Number(criteria.children)

  if (!Number.isFinite(adults) || !Number.isInteger(adults) || adults < 1 || adults > 9) {
    errors.push('adults must be an integer between 1 and 9')
  }
  if (!Number.isFinite(children) || !Number.isInteger(children) || children < 0 || children > 8) {
    errors.push('children must be an integer between 0 and 8')
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

  let cabin: string | null = criteria.cabin?.trim() || null
  if (cabin) {
    const key = cabin.toLowerCase().replace(/[\s-]+/g, '_')
    if (!ALLOWED_CABINS.has(cabin.toLowerCase()) && !ALLOWED_CABINS.has(key)) {
      errors.push('cabin must be economy, premium_economy, business, or first')
    } else {
      cabin = key === 'premiumeconomy' || key === 'premium-economy'
        ? 'premium_economy'
        : key
    }
  }

  let maxResults: number | undefined
  if (criteria.maxResults != null) {
    const max = Number(criteria.maxResults)
    if (!Number.isFinite(max) || !Number.isInteger(max) || max < 1 || max > 250) {
      errors.push('maxResults must be an integer between 1 and 250')
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
      origin,
      destination,
      departureDate,
      returnDate,
      adults,
      children,
      cabin,
      currency,
      maxResults: maxResults ?? criteria.maxResults ?? 20,
      nonStop: criteria.nonStop === true,
      timeoutMs: criteria.timeoutMs,
      signal: criteria.signal,
    },
  }
}
