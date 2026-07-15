/**
 * Phase AF — TripPlanner request validation (user-safe errors).
 */

import {
  SUPPORTED_TRIP_CURRENCIES,
  type TripPlannerRequest,
  type TripPlannerValidationError,
} from './models'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  if (d.toISOString().slice(0, 10) !== value) return null
  return d
}

export function validateTripPlannerRequest(
  request: TripPlannerRequest,
  nowMs: number = Date.now(),
): TripPlannerValidationError[] {
  const errors: TripPlannerValidationError[] = []

  if (!request.requestId?.trim()) {
    errors.push({
      code: 'missing_request_id',
      message: 'A request id is required.',
      field: 'requestId',
    })
  }
  if (!request.userId?.trim()) {
    errors.push({
      code: 'missing_user_id',
      message: 'A user id is required.',
      field: 'userId',
    })
  }
  if (!request.idempotencyKey?.trim()) {
    errors.push({
      code: 'missing_idempotency_key',
      message: 'An idempotency key is required.',
      field: 'idempotencyKey',
    })
  }

  const destinations = (request.destinations ?? [])
    .map((d) => d.trim())
    .filter(Boolean)
  if (destinations.length === 0) {
    errors.push({
      code: 'missing_destination',
      message: 'At least one destination is required.',
      field: 'destinations',
    })
  }

  const adults = request.travelers?.adults ?? 0
  const children = request.travelers?.children ?? 0
  const infants = request.travelers?.infants ?? 0
  const totalTravelers = adults + children + infants
  if (!Number.isFinite(adults) || adults < 1) {
    errors.push({
      code: 'invalid_traveler_count',
      message: 'At least one adult traveler is required.',
      field: 'travelers.adults',
    })
  } else if (totalTravelers > 20) {
    errors.push({
      code: 'invalid_traveler_count',
      message: 'Traveler count must be 20 or fewer.',
      field: 'travelers',
    })
  }
  if (children < 0 || infants < 0) {
    errors.push({
      code: 'invalid_traveler_count',
      message: 'Child and infant counts cannot be negative.',
      field: 'travelers',
    })
  }

  const currency = (request.currency ?? request.budget?.currency ?? 'USD').toUpperCase()
  if (!SUPPORTED_TRIP_CURRENCIES.includes(currency as (typeof SUPPORTED_TRIP_CURRENCIES)[number])) {
    errors.push({
      code: 'unsupported_currency',
      message: `Currency ${currency} is not supported.`,
      field: 'currency',
    })
  }

  if (request.budget != null) {
    if (!Number.isFinite(request.budget.amount) || request.budget.amount <= 0) {
      errors.push({
        code: 'invalid_budget',
        message: 'Budget must be a positive amount.',
        field: 'budget.amount',
      })
    }
  }

  const flexible = request.flexibleDates === true
  const start = request.startDate?.trim() || null
  const end = request.endDate?.trim() || null

  if (!flexible) {
    if (!start || !end) {
      errors.push({
        code: 'invalid_travel_dates',
        message: 'Start and end dates are required unless flexible dates are enabled.',
        field: 'startDate',
      })
    }
  }

  let startDate: Date | null = null
  let endDate: Date | null = null
  if (start) {
    startDate = parseIsoDate(start)
    if (!startDate) {
      errors.push({
        code: 'invalid_travel_dates',
        message: 'Start date must be a valid ISO date (YYYY-MM-DD).',
        field: 'startDate',
      })
    }
  }
  if (end) {
    endDate = parseIsoDate(end)
    if (!endDate) {
      errors.push({
        code: 'invalid_travel_dates',
        message: 'End date must be a valid ISO date (YYYY-MM-DD).',
        field: 'endDate',
      })
    }
  }
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    errors.push({
      code: 'invalid_travel_dates',
      message: 'End date must be on or after the start date.',
      field: 'endDate',
    })
  }

  if (flexible) {
    const duration = request.durationDays
    if (duration == null || !Number.isFinite(duration) || duration < 1) {
      errors.push({
        code: 'invalid_duration',
        message: 'Flexible-date requests require a positive durationDays value.',
        field: 'durationDays',
      })
    }
  } else if (startDate && endDate) {
    const days =
      Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
    if (days < 1 || days > 60) {
      errors.push({
        code: 'invalid_travel_dates',
        message: 'Trip duration must be between 1 and 60 days.',
        field: 'endDate',
      })
    }
  }

  if (request.durationDays != null) {
    if (!Number.isFinite(request.durationDays) || request.durationDays < 1 || request.durationDays > 60) {
      errors.push({
        code: 'invalid_duration',
        message: 'durationDays must be between 1 and 60.',
        field: 'durationDays',
      })
    }
  }

  const constraints = request.constraints
  if (constraints?.preferRelaxedPace && constraints.preferPackedSchedule) {
    errors.push({
      code: 'conflicting_constraints',
      message: 'Cannot prefer both a relaxed pace and a packed schedule.',
      field: 'constraints',
    })
  }
  if (
    constraints?.maxFlightStops != null &&
    constraints.preferDirectFlights === true &&
    constraints.maxFlightStops > 0
  ) {
    errors.push({
      code: 'conflicting_constraints',
      message: 'Direct-flight preference conflicts with allowing flight stops.',
      field: 'constraints.maxFlightStops',
    })
  }

  if (request.expiresAt) {
    const exp = Date.parse(request.expiresAt)
    if (Number.isNaN(exp)) {
      errors.push({
        code: 'invalid_request_context',
        message: 'Request expiry timestamp is invalid.',
        field: 'expiresAt',
      })
    } else if (exp <= nowMs) {
      errors.push({
        code: 'expired_request_context',
        message: 'This planning request has expired. Please submit a new request.',
        field: 'expiresAt',
      })
    }
  }

  const lang = request.preferredLanguage
  if (lang != null && lang !== 'ar' && lang !== 'en') {
    errors.push({
      code: 'unsupported_language',
      message: 'Preferred language must be Arabic (ar) or English (en).',
      field: 'preferredLanguage',
    })
  }

  return errors
}

export function resolveDurationDays(request: TripPlannerRequest): number {
  if (request.durationDays != null && request.durationDays >= 1) {
    return Math.min(60, Math.floor(request.durationDays))
  }
  if (request.startDate && request.endDate) {
    const start = parseIsoDate(request.startDate)
    const end = parseIsoDate(request.endDate)
    if (start && end) {
      return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
    }
  }
  return 5
}

export function resolveCurrency(request: TripPlannerRequest): string {
  return (request.currency ?? request.budget?.currency ?? 'USD').toUpperCase()
}
