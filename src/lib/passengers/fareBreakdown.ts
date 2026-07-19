/**
 * Fare / tax / fee breakdown for booking summary (provider-agnostic).
 */

import { TAX_RATE, RAHHAL_SERVICE_FEE } from '../payment/checkoutTypes'
import type { FareBreakdown, SelectedFlightSummary } from './types'
import type { BookingItem, BookingSession } from '../booking/bookingTypes'

export function buildFareBreakdown(
  fareAmount: number,
  currency: string,
  options?: { taxRate?: number; fees?: number },
): FareBreakdown {
  const taxRate = options?.taxRate ?? TAX_RATE
  const fees = options?.fees ?? RAHHAL_SERVICE_FEE
  const safeFare = Math.max(0, Number(fareAmount) || 0)
  const taxes = Math.round(safeFare * taxRate * 100) / 100
  const grandTotal = Math.round((safeFare + taxes + fees) * 100) / 100
  return {
    fare: safeFare,
    taxes,
    fees,
    grandTotal,
    currency: currency || 'SAR',
    taxRate,
  }
}

export function flightSummaryFromBookingItem(item: BookingItem | null | undefined): SelectedFlightSummary | null {
  if (!item || item.type !== 'flight') return null
  const itinerary = (item.metadata.selectedItinerary ?? {}) as Record<string, unknown>
  const pricing = (item.metadata.pricing ?? {}) as Record<string, unknown>
  return {
    title: item.title,
    airline: String(itinerary.airline ?? item.providerName ?? ''),
    origin: String(itinerary.origin ?? ''),
    destination: String(itinerary.destination ?? ''),
    departureTime: String(itinerary.departureTime ?? ''),
    arrivalTime: String(itinerary.arrivalTime ?? ''),
    cabin: String(itinerary.cabin ?? ''),
    stops: typeof itinerary.stops === 'number' ? itinerary.stops : null,
    price: Number(pricing.amount ?? item.price) || item.price,
    currency: String(pricing.currency ?? item.currency) || item.currency,
  }
}

export function fareBreakdownFromSession(session: BookingSession): FareBreakdown {
  const flight = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  const amount = flight?.price ?? session.subtotal
  const currency = flight?.currency ?? session.currency
  return buildFareBreakdown(amount, currency, { fees: session.fees })
}
