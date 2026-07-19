import type { PlanningField, PlanningSession } from './types'

/** Intake order — ask only what's missing, never twice. */
export const PLANNING_INTAKE_ORDER: PlanningField[] = [
  'destination',
  'departureCity',
  'travelDates',
  'travelerCount',
  'budget',
  'cabinClass',
  'airlinePreferences',
  'hotelPreferences',
  'roomRequirements',
  'transportation',
  'activities',
  'notes',
]

/** Minimum fields to produce a complete TripPlan. */
export const PLANNING_REQUIRED: PlanningField[] = [
  'destination',
  'travelDates',
  'travelerCount',
]

export function isPlanningFieldFilled(
  session: PlanningSession,
  field: PlanningField,
): boolean {
  switch (field) {
    case 'destination':
      return Boolean(session.destination)
    case 'departureCity':
      return Boolean(session.departureCity)
    case 'travelDates':
      return (
        session.travelDates.durationDays != null ||
        Boolean(session.travelDates.startDate) ||
        Boolean(session.travelDates.startDate && session.travelDates.endDate) ||
        session.travelDates.flexible ||
        session.flexibility
      )
    case 'travelerCount':
      return session.travelerCount != null || session.adults != null
    case 'cabinClass':
      return session.cabinClass != null
    case 'hotelPreferences':
      return session.hotelPreferences.length > 0
    case 'roomRequirements':
      return Boolean(session.roomRequirements)
    case 'transportation':
      return session.transportation.length > 0
    case 'activities':
      return session.activities.length > 0
    case 'budget':
      return session.budget.amount != null || session.budget.flexible
    case 'airlinePreferences':
      return session.airlinePreferences.length > 0
    case 'notes':
      return Boolean(session.notes)
    default:
      return false
  }
}

/**
 * Detect missing required information.
 * Never includes fields already asked.
 */
export function detectMissingPlanningFields(session: PlanningSession): PlanningField[] {
  const missing: PlanningField[] = []
  for (const field of PLANNING_INTAKE_ORDER) {
    if (!PLANNING_REQUIRED.includes(field)) continue
    if (isPlanningFieldFilled(session, field)) continue
    if (session.askedFields.includes(field)) continue
    missing.push(field)
  }
  return missing
}

export function nextPlanningFieldToAsk(missing: PlanningField[]): PlanningField | null {
  return missing[0] ?? null
}

export function planningCompleteness(session: PlanningSession): number {
  const known = PLANNING_REQUIRED.filter((f) => isPlanningFieldFilled(session, f)).length
  return PLANNING_REQUIRED.length === 0 ? 1 : known / PLANNING_REQUIRED.length
}
