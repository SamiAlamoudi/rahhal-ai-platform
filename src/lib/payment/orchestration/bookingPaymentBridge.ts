/**
 * Booking ↔ payment bridge (library-level only — no UI changes).
 *
 * Maps BookingSession items into CheckoutInitInput so BookingReview / saved
 * booking cart payloads can enter hosted checkout without altering
 * TripPlan APIs or the BookingReview UI in this phase.
 */

import type { BookingItem, BookingSession } from '../../booking/bookingTypes'
import type { CheckoutInitInput } from '../checkoutOrchestrator'
import type { CheckoutItem, TravelerInfo } from '../checkoutTypes'

export interface BookingPaymentBridgeInput {
  bookingSession: BookingSession
  travelers?: TravelerInfo[]
  customerEmail?: string | null
  customerName?: string | null
  couponCode?: string | null
  returnUrl: string
}

export interface BookingPaymentPrepareResult {
  checkoutInit: CheckoutInitInput
  customerEmail: string | null
  customerName: string | null
  returnUrl: string
  bookingSessionId: string
  itemCount: number
  total: number
  currency: string
}

/**
 * Convert a booking session into checkout initiation input.
 * Does not start payment — PaymentOrchestrator.startFromBooking does that.
 */
export function prepareBookingPayment(
  input: BookingPaymentBridgeInput,
): BookingPaymentPrepareResult {
  const { bookingSession } = input
  if (!bookingSession.items.length) {
    throw new Error('Booking session has no items to pay for')
  }

  const items = bookingSession.items.map(bookingItemToCheckoutItem)
  const currency = bookingSession.currency || items[0]?.currency || 'SAR'

  return {
    checkoutInit: {
      userId: bookingSession.userId,
      travelSessionId: bookingSession.travelSessionId,
      items,
      currency,
      travelers: input.travelers ?? [],
      couponCode: input.couponCode ?? null,
    },
    customerEmail: input.customerEmail ?? null,
    customerName: input.customerName ?? null,
    returnUrl: input.returnUrl,
    bookingSessionId: bookingSession.id,
    itemCount: items.length,
    total: bookingSession.total,
    currency,
  }
}

export function bookingItemToCheckoutItem(item: BookingItem): CheckoutItem {
  return {
    id: item.id,
    type: item.type,
    providerId: item.providerId,
    providerName: item.providerName,
    providerOfferId: item.providerOfferId,
    title: item.title,
    price: item.price,
    currency: item.currency,
    bookingUrl: item.bookingUrl,
    expiresAt: item.expiresAt,
    travelerSummary: item.travelerSummary,
    metadata: {
      ...item.metadata,
      bookingMode: item.bookingMode,
      selectedAt: item.selectedAt,
      source: 'booking_session',
    },
  }
}
