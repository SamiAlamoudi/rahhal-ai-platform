/**
 * Sprint 101 — smart booking warnings from existing supporting data only.
 * Never invent warnings without evidence from price / inventory / document signals.
 */

import type { BookingAssistantComposeInput } from './BookingReadiness'

export type BookingWarningKind =
  | 'passport_expiring'
  | 'flight_availability_low'
  | 'hotel_inventory_limited'
  | 'price_likely_increase'
  | 'visa_may_be_required'

export interface BookingWarningItem {
  kind: BookingWarningKind
  severity: 'high' | 'medium' | 'low'
  message: string
}

export interface BookingWarningsSection {
  id: 'warnings'
  items: BookingWarningItem[]
}

export function buildBookingWarnings(
  input: BookingAssistantComposeInput,
): BookingWarningsSection | null {
  const items: BookingWarningItem[] = []

  if (input.passportStatus === 'expiring' || (input.passportExpiresAt && input.passportStatus !== 'ok')) {
    items.push({
      kind: 'passport_expiring',
      severity: 'high',
      message: input.passportExpiresAt
        ? `Passport expires soon (${input.passportExpiresAt}).`
        : 'Passport expires soon.',
    })
  }

  if (typeof input.seatsRemaining === 'number' && input.seatsRemaining <= 5) {
    items.push({
      kind: 'flight_availability_low',
      severity: input.seatsRemaining <= 3 ? 'high' : 'medium',
      message: `Flight availability low — ${input.seatsRemaining} seat(s) remaining.`,
    })
  }

  if (typeof input.roomsRemaining === 'number' && input.roomsRemaining <= 3) {
    items.push({
      kind: 'hotel_inventory_limited',
      severity: input.roomsRemaining <= 1 ? 'high' : 'medium',
      message: `Hotel inventory limited — ${input.roomsRemaining} room(s) remaining.`,
    })
  }

  const opportunities = input.priceOpportunities ?? []
  const action = (input.priceTimingAction ?? '').toUpperCase()
  const explanation = (input.priceExplanation ?? '').toLowerCase()
  const priceIncrease =
    opportunities.includes('likely_increase')
    || action === 'BOOK_NOW'
    || action === 'LIMITED_AVAILABILITY'
    || /increas|rise|book (soon|now)/i.test(explanation)

  if (priceIncrease && (opportunities.length > 0 || action || input.priceExplanation)) {
    items.push({
      kind: 'price_likely_increase',
      severity: action === 'BOOK_NOW' || action === 'LIMITED_AVAILABILITY' ? 'high' : 'medium',
      message: input.priceExplanation?.trim()
        || 'Price likely to increase — existing timing signals suggest booking sooner.',
    })
  }

  if (input.visaRequiredSignal === true) {
    items.push({
      kind: 'visa_may_be_required',
      severity: 'medium',
      message: 'Visa may be required for this destination.',
    })
  }

  if (items.length === 0) return null
  return { id: 'warnings', items }
}
