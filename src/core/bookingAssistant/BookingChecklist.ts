/**
 * Sprint 101 — dynamic booking checklist from existing selection / requirement signals.
 */

import type { BookingAssistantComposeInput } from './BookingReadiness'

export type BookingChecklistItemId =
  | 'flight_selected'
  | 'hotel_selected'
  | 'package_selected'
  | 'dates_confirmed'
  | 'travelers_confirmed'
  | 'budget_confirmed'
  | 'preferences_applied'

export interface BookingChecklistItem {
  id: BookingChecklistItemId
  label: string
  complete: boolean
}

export interface BookingChecklistSection {
  id: 'checklist'
  items: BookingChecklistItem[]
  completedCount: number
  totalCount: number
}

export function buildBookingChecklist(
  input: BookingAssistantComposeInput,
): BookingChecklistSection | null {
  const items: BookingChecklistItem[] = []

  const flightDone = Boolean(input.flightSelected || input.flight?.id)
  const hotelDone = Boolean(input.hotelSelected || input.hotel?.id)
  const packageDone = Boolean(input.packageSelected || input.packageOffer?.id)

  // Only include selection rows when that domain has been considered (signal present or selected).
  if (flightDone || input.flightSelected === false) {
    items.push({
      id: 'flight_selected',
      label: 'Flight Selected',
      complete: flightDone,
    })
  }
  if (hotelDone || input.hotelSelected === false) {
    items.push({
      id: 'hotel_selected',
      label: 'Hotel Selected',
      complete: hotelDone,
    })
  }
  if (packageDone || input.packageSelected === false) {
    items.push({
      id: 'package_selected',
      label: 'Package Selected',
      complete: packageDone,
    })
  }

  // Always show core trip-intake checklist when any planning signal exists.
  const hasPlanningSignal = Boolean(
    input.destination
    || input.startDate
    || input.travelers != null
    || input.budgetAmount != null
    || flightDone
    || hotelDone
    || packageDone
    || (input.missingFields && input.missingFields.length > 0)
    || input.alpha?.enabled,
  )
  if (!hasPlanningSignal) return null

  const datesDone = Boolean(input.startDate)
    || (input.durationDays != null && Number.isFinite(input.durationDays))
  items.push({
    id: 'dates_confirmed',
    label: 'Dates Confirmed',
    complete: datesDone,
  })

  items.push({
    id: 'travelers_confirmed',
    label: 'Travelers Confirmed',
    complete: input.travelers != null && input.travelers > 0,
  })

  items.push({
    id: 'budget_confirmed',
    label: 'Budget Confirmed',
    complete: input.budgetAmount != null && Number.isFinite(input.budgetAmount),
  })

  if (input.preferencesApplied != null) {
    items.push({
      id: 'preferences_applied',
      label: 'Preferences Applied',
      complete: input.preferencesApplied === true,
    })
  }

  if (items.length === 0) return null

  const completedCount = items.filter((i) => i.complete).length
  return {
    id: 'checklist',
    items,
    completedCount,
    totalCount: items.length,
  }
}
