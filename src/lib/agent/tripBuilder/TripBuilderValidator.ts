/**
 * Sprint 110 — TripBuilderValidator
 * Validates dates, budget, destination, and offer pools.
 */

import type { TripBuilderInput } from './types'

export interface TripBuilderValidation {
  ok: boolean
  errors: string[]
  normalized: {
    destination: string
    departureDate: string
    returnDate: string | null
    checkInDate: string
    checkOutDate: string
    budget: number | null
    currency: string
    adults: number
    children: number
    maxCandidates: number
  } | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function validateTripBuilderInput(
  input: TripBuilderInput,
): TripBuilderValidation {
  const errors: string[] = []

  const destination = typeof input.destination === 'string'
    ? input.destination.trim()
    : ''
  if (!destination) {
    errors.push('destination is required')
  }

  const departureDate = typeof input.departureDate === 'string'
    ? input.departureDate.trim()
    : ''
  if (!departureDate) {
    errors.push('departureDate is required')
  } else if (!isValidDateString(departureDate)) {
    errors.push('departureDate must be YYYY-MM-DD')
  }

  let returnDate: string | null = null
  if (input.returnDate != null && String(input.returnDate).trim()) {
    returnDate = String(input.returnDate).trim()
    if (!isValidDateString(returnDate)) {
      errors.push('returnDate must be YYYY-MM-DD')
      returnDate = null
    }
  }

  if (
    departureDate
    && returnDate
    && isValidDateString(departureDate)
    && isValidDateString(returnDate)
    && returnDate < departureDate
  ) {
    errors.push('returnDate must be on or after departureDate')
  }

  let checkInDate =
    input.checkInDate != null && String(input.checkInDate).trim()
      ? String(input.checkInDate).trim()
      : departureDate
  if (checkInDate && !isValidDateString(checkInDate)) {
    errors.push('checkInDate must be YYYY-MM-DD')
    checkInDate = departureDate
  }

  let checkOutDate =
    input.checkOutDate != null && String(input.checkOutDate).trim()
      ? String(input.checkOutDate).trim()
      : returnDate
        ?? (departureDate && isValidDateString(departureDate)
          ? addDays(departureDate, 1)
          : '')
  if (checkOutDate && !isValidDateString(checkOutDate)) {
    errors.push('checkOutDate must be YYYY-MM-DD')
    checkOutDate = ''
  }

  if (
    checkInDate
    && checkOutDate
    && isValidDateString(checkInDate)
    && isValidDateString(checkOutDate)
    && checkOutDate <= checkInDate
  ) {
    errors.push('checkOutDate must be after checkInDate')
  }

  if (
    departureDate
    && checkInDate
    && isValidDateString(departureDate)
    && isValidDateString(checkInDate)
    && checkInDate < departureDate
  ) {
    errors.push('checkInDate must be on or after departureDate')
  }

  if (
    returnDate
    && checkOutDate
    && isValidDateString(returnDate)
    && isValidDateString(checkOutDate)
    && checkOutDate > returnDate
  ) {
    errors.push('checkOutDate must be on or before returnDate')
  }

  let budget: number | null = null
  if (input.budget != null) {
    if (typeof input.budget !== 'number' || !Number.isFinite(input.budget)) {
      errors.push('budget must be a finite number')
    } else if (input.budget <= 0) {
      errors.push('budget must be greater than zero')
    } else {
      budget = input.budget
    }
  }

  const adults = input.adults == null ? 1 : input.adults
  if (!Number.isInteger(adults) || adults < 1) {
    errors.push('adults must be an integer >= 1')
  }

  const children = input.children == null ? 0 : input.children
  if (!Number.isInteger(children) || children < 0) {
    errors.push('children must be an integer >= 0')
  }

  const maxCandidates = input.maxCandidates == null ? 36 : input.maxCandidates
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
    errors.push('maxCandidates must be an integer >= 1')
  }

  const currency = (input.currency?.trim() || 'SAR').toUpperCase()

  if (errors.length > 0) {
    return { ok: false, errors, normalized: null }
  }

  return {
    ok: true,
    errors: [],
    normalized: {
      destination,
      departureDate,
      returnDate,
      checkInDate,
      checkOutDate,
      budget,
      currency,
      adults: adults as number,
      children: children as number,
      maxCandidates: maxCandidates as number,
    },
  }
}

export class TripBuilderValidator {
  validate(input: TripBuilderInput): TripBuilderValidation {
    return validateTripBuilderInput(input)
  }
}

export function createTripBuilderValidator(): TripBuilderValidator {
  return new TripBuilderValidator()
}
