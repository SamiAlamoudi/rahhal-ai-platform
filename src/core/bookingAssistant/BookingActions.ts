/**
 * Sprint 101 — suggested next booking actions (presentation only).
 */

import type { BookingChecklistSection } from './BookingChecklist'
import type { BookingAssistantComposeInput, BookingReadinessSection } from './BookingReadiness'
import type { MissingRequirementsSection } from './MissingRequirements'

export type BookingActionId =
  | 'continue_searching'
  | 'compare_alternatives'
  | 'choose_hotel'
  | 'choose_flight'
  | 'reserve_package'
  | 'complete_traveler_information'
  | 'confirm_destination'
  | 'confirm_dates'
  | 'add_payment_method'
  | 'provide_passport'
  | 'proceed_to_booking'
  | 'complete_payment'
  | 'view_confirmation'

export interface BookingActionItem {
  id: BookingActionId
  label: string
  primary: boolean
}

export interface BookingActionsSection {
  id: 'actions'
  primary: BookingActionItem
  alternatives: BookingActionItem[]
}

export function buildBookingActions(
  input: BookingAssistantComposeInput,
  readiness: BookingReadinessSection,
  checklist: BookingChecklistSection | null,
  missing: MissingRequirementsSection | null,
): BookingActionsSection | null {
  if (input.bookingConfirmed) {
    return {
      id: 'actions',
      primary: { id: 'view_confirmation', label: 'View confirmation', primary: true },
      alternatives: [],
    }
  }

  if (input.paymentSessionActive) {
    return {
      id: 'actions',
      primary: { id: 'complete_payment', label: 'Complete payment', primary: true },
      alternatives: [
        { id: 'compare_alternatives', label: 'Compare alternatives', primary: false },
      ],
    }
  }

  if (readiness.status === 'need_destination_confirmation') {
    return {
      id: 'actions',
      primary: { id: 'confirm_destination', label: 'Confirm destination', primary: true },
      alternatives: [
        { id: 'continue_searching', label: 'Continue searching', primary: false },
      ],
    }
  }

  if (readiness.status === 'need_traveler_information') {
    return {
      id: 'actions',
      primary: {
        id: 'complete_traveler_information',
        label: 'Complete traveler information',
        primary: true,
      },
      alternatives: [],
    }
  }

  if (readiness.status === 'need_dates') {
    return {
      id: 'actions',
      primary: { id: 'confirm_dates', label: 'Confirm dates', primary: true },
      alternatives: [],
    }
  }

  if (readiness.status === 'need_passport') {
    return {
      id: 'actions',
      primary: { id: 'provide_passport', label: 'Provide passport details', primary: true },
      alternatives: [],
    }
  }

  if (readiness.status === 'need_payment_method') {
    return {
      id: 'actions',
      primary: { id: 'add_payment_method', label: 'Add payment method', primary: true },
      alternatives: [
        { id: 'compare_alternatives', label: 'Compare alternatives', primary: false },
      ],
    }
  }

  if (readiness.readyToBook) {
    const alternatives: BookingActionItem[] = [
      { id: 'compare_alternatives', label: 'Compare alternatives', primary: false },
    ]
    if (input.packageOffer || input.packageSelected) {
      alternatives.unshift({
        id: 'reserve_package',
        label: 'Reserve package',
        primary: false,
      })
    }
    return {
      id: 'actions',
      primary: { id: 'proceed_to_booking', label: 'Proceed to booking', primary: true },
      alternatives,
    }
  }

  // Selection gaps
  const incomplete = checklist?.items.filter((i) => !i.complete) ?? []
  if (incomplete.some((i) => i.id === 'hotel_selected') && (input.flight || input.flightSelected)) {
    return {
      id: 'actions',
      primary: { id: 'choose_hotel', label: 'Choose hotel', primary: true },
      alternatives: [
        { id: 'compare_alternatives', label: 'Compare alternatives', primary: false },
        { id: 'continue_searching', label: 'Continue searching', primary: false },
      ],
    }
  }
  if (incomplete.some((i) => i.id === 'flight_selected') && (input.hotel || input.hotelSelected)) {
    return {
      id: 'actions',
      primary: { id: 'choose_flight', label: 'Choose flight', primary: true },
      alternatives: [
        { id: 'continue_searching', label: 'Continue searching', primary: false },
      ],
    }
  }
  if (incomplete.some((i) => i.id === 'package_selected') || input.packageSelected === false) {
    return {
      id: 'actions',
      primary: { id: 'reserve_package', label: 'Reserve package', primary: true },
      alternatives: [
        { id: 'compare_alternatives', label: 'Compare alternatives', primary: false },
      ],
    }
  }

  if (missing && missing.items.length > 0) {
    return {
      id: 'actions',
      primary: {
        id: 'complete_traveler_information',
        label: 'Complete traveler information',
        primary: true,
      },
      alternatives: [
        { id: 'continue_searching', label: 'Continue searching', primary: false },
      ],
    }
  }

  if (input.alpha?.nextAction) {
    return {
      id: 'actions',
      primary: {
        id: 'continue_searching',
        label: input.alpha.nextAction,
        primary: true,
      },
      alternatives: [
        { id: 'compare_alternatives', label: 'Compare alternatives', primary: false },
      ],
    }
  }

  // Hide when there is nothing actionable yet.
  if (!input.destination && !input.alpha?.enabled) return null

  return {
    id: 'actions',
    primary: { id: 'continue_searching', label: 'Continue searching', primary: true },
    alternatives: [
      { id: 'compare_alternatives', label: 'Compare alternatives', primary: false },
    ],
  }
}
