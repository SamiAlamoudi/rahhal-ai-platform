/**
 * Sprint 101 — booking summary card (compose existing flight/hotel/package/confidence).
 */

import type { BookingActionItem } from './BookingActions'
import type { BookingAssistantComposeInput } from './BookingReadiness'

export interface BookingSummarySection {
  id: 'summary'
  flightLabel: string | null
  hotelLabel: string | null
  packageLabel: string | null
  estimatedTotal: number | null
  savings: number | null
  currency: string
  confidenceScore: number | null
  confidenceLevel: string | null
  recommendedNextAction: string | null
}

function moneyParts(
  price: number | null | undefined,
  currency: string | null | undefined,
  fallbackCurrency: string,
): { price: number | null; currency: string } {
  return {
    price: typeof price === 'number' && Number.isFinite(price) ? price : null,
    currency: (currency || fallbackCurrency).toUpperCase(),
  }
}

export function buildBookingAssistantSummary(
  input: BookingAssistantComposeInput,
  nextAction: BookingActionItem | null,
): BookingSummarySection | null {
  const currency = (
    input.currency
    || input.packageOffer?.currency
    || input.flight?.currency
    || input.hotel?.currency
    || input.budgetCurrency
    || 'SAR'
  ).toUpperCase()

  const flight = input.flight
  const hotel = input.hotel
  const pkg = input.packageOffer

  const flightLabel = flight
    ? [flight.airline, flight.origin && flight.destination
      ? `${flight.origin} → ${flight.destination}`
      : null].filter(Boolean).join(' · ') || `Flight ${flight.id}`
    : null

  const hotelLabel = hotel
    ? (hotel.name?.trim() || `Hotel ${hotel.id}`)
    : null

  const packageLabel = pkg
    ? (pkg.title?.trim() || `Package ${pkg.id}`)
    : null

  let estimatedTotal = typeof input.estimatedTotal === 'number' && Number.isFinite(input.estimatedTotal)
    ? input.estimatedTotal
    : null
  if (estimatedTotal == null && pkg?.totalPrice != null) {
    estimatedTotal = pkg.totalPrice
  }
  if (estimatedTotal == null) {
    const f = moneyParts(flight?.price, flight?.currency, currency).price
    const h = moneyParts(hotel?.price, hotel?.currency, currency).price
    if (f != null || h != null) {
      estimatedTotal = (f ?? 0) + (h ?? 0)
    }
  }

  const confidenceScore = input.confidenceScore
    ?? input.alpha?.confidenceScore
    ?? null
  const confidenceLevel = input.confidenceLevel
    ?? input.alpha?.confidenceLevel
    ?? null

  const hasAny = Boolean(
    flightLabel
    || hotelLabel
    || packageLabel
    || estimatedTotal != null
    || confidenceScore != null
    || nextAction,
  )
  if (!hasAny) return null

  const savings = typeof input.savings === 'number' && Number.isFinite(input.savings)
    ? input.savings
    : null

  return {
    id: 'summary',
    flightLabel,
    hotelLabel,
    packageLabel,
    estimatedTotal,
    savings,
    currency,
    confidenceScore,
    confidenceLevel,
    recommendedNextAction: nextAction?.label
      ?? input.alpha?.nextAction
      ?? null,
  }
}
