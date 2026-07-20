/**
 * Bridge Booking Execution → Payments — Sprint 58.
 */

import type { BookingExecutionResult } from '../bookingExecution/types'
import type { PaymentMethod } from './types'

export function amountFromBookingExecution(
  execution: BookingExecutionResult,
): { amount: number; currency: string } {
  const currency =
    execution.bookings[0]?.pricing.currency
    || execution.session.items[0]?.price.currency
    || 'SAR'
  const amount = execution.bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'ticketed')
    .reduce((sum, b) => sum + (b.pricing.amount + (b.taxes?.amount ?? 0)), 0)
  if (amount > 0) return { amount, currency }
  const fallback = execution.session.items.reduce((sum, i) => sum + i.price.amount, 0)
  return { amount: fallback, currency }
}

export function shouldRunPayments(input: {
  userText?: string | null
  intent?: string | null
  bookingExecutionStatus?: string | null
}): boolean {
  const status = input.bookingExecutionStatus || ''
  if (status !== 'confirmed' && status !== 'ticketed' && status !== 'pending') {
    // Allow pending when some bookings confirmed (partial)
    if (!status) return false
  }
  const intent = (input.intent || '').toLowerCase()
  if (
    intent === 'how_much_will_i_pay'
    || intent === 'what_is_payment_status'
    || intent === 'show_checkout'
    || intent === 'booking_confirmed'
  ) {
    return true
  }
  const text = (input.userText || '').toLowerCase()
  if (!text) return false
  return (
    /ادفع|دفع|أكمل الدفع|سداد/.test(text)
    || /\b(pay now|complete payment|checkout|apple pay|mada|stc pay|tabby|tamara)\b/.test(text)
    || /confirm booking now|book now/.test(text)
  )
}

export function detectPaymentMethod(userText?: string | null): PaymentMethod {
  const text = (userText || '').toLowerCase()
  if (/apple\s*pay/.test(text)) return 'apple_pay'
  if (/google\s*pay/.test(text)) return 'google_pay'
  if (/mada|مدى/.test(text)) return 'mada'
  if (/stc/.test(text)) return 'stc_pay'
  if (/tabby/.test(text)) return 'tabby'
  if (/tamara|تمارا/.test(text)) return 'tamara'
  if (/bank|تحويل/.test(text)) return 'bank_transfer'
  return 'card'
}
