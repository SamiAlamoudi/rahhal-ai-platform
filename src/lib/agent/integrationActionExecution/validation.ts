/**
 * Integration Sprint 11 — action validation before confirmation / execution.
 */

import type { TripPlan } from '../types'
import type { ActionKind, ActionValidation } from './types'

export function validateAction(input: {
  action: ActionKind
  plan?: TripPlan | null
}): ActionValidation {
  const missing: string[] = []
  const warnings: string[] = []
  const plan = input.plan

  if (!plan) {
    if (
      input.action === 'book_flight'
      || input.action === 'reserve_hotel'
      || input.action === 'save_itinerary'
      || input.action === 'share_trip'
      || input.action === 'modify_booking'
    ) {
      missing.push('trip_plan')
    }
  } else {
    if (input.action === 'book_flight' && plan.flights.length === 0) {
      warnings.push('no_flight_on_plan')
    }
    if (input.action === 'reserve_hotel' && plan.accommodations.length === 0) {
      warnings.push('no_hotel_on_plan')
    }
  }

  if (input.action === 'cancel_booking' || input.action === 'modify_booking') {
    warnings.push('uses_preview_or_mock_reference')
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  }
}
