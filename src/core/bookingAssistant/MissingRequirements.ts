/**
 * Sprint 101 — missing requirements list (from existing missingFields + checklist gaps).
 */

import type { BookingChecklistSection } from './BookingChecklist'
import type { BookingAssistantComposeInput, BookingReadinessSection } from './BookingReadiness'

export interface MissingRequirementItem {
  field: string
  label: string
  priority: 'critical' | 'high' | 'medium'
}

export interface MissingRequirementsSection {
  id: 'missing_requirements'
  items: MissingRequirementItem[]
}

const FIELD_LABELS: Record<string, string> = {
  destination: 'Destination',
  startDate: 'Start date',
  endDate: 'End date',
  durationDays: 'Duration',
  travelers: 'Travelers',
  budgetAmount: 'Budget',
  origin: 'Departure city',
  passport: 'Passport',
  payment_method: 'Payment method',
  flight: 'Flight selection',
  hotel: 'Hotel selection',
  package: 'Package selection',
}

export function buildMissingRequirements(
  input: BookingAssistantComposeInput,
  readiness: BookingReadinessSection,
  checklist: BookingChecklistSection | null,
): MissingRequirementsSection | null {
  const items: MissingRequirementItem[] = []
  const seen = new Set<string>()

  const push = (field: string, priority: MissingRequirementItem['priority']) => {
    if (seen.has(field)) return
    seen.add(field)
    items.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      priority,
    })
  }

  for (const field of input.missingFields ?? []) {
    push(String(field), 'critical')
  }

  if (readiness.status === 'need_destination_confirmation') push('destination', 'critical')
  if (readiness.status === 'need_traveler_information') push('travelers', 'critical')
  if (readiness.status === 'need_dates') {
    push('startDate', 'critical')
  }
  if (readiness.status === 'need_passport') push('passport', 'critical')
  if (readiness.status === 'need_payment_method') push('payment_method', 'high')

  if (checklist) {
    for (const item of checklist.items) {
      if (item.complete) continue
      if (item.id === 'flight_selected') push('flight', 'high')
      if (item.id === 'hotel_selected') push('hotel', 'high')
      if (item.id === 'package_selected') push('package', 'medium')
      if (item.id === 'dates_confirmed') push('startDate', 'critical')
      if (item.id === 'travelers_confirmed') push('travelers', 'critical')
      if (item.id === 'budget_confirmed') push('budgetAmount', 'high')
    }
  }

  if (items.length === 0) return null
  return { id: 'missing_requirements', items }
}
