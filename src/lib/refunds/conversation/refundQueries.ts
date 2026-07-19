/**
 * Sprint 36 — Conversation helpers for cancellation/refund questions.
 * Explains PolicyEngine quotes in simple language — no duplicated calc logic.
 */

import { isRefundPolicyEngineEnabled } from '../PolicyFeatureFlags'
import type { PolicyEngine } from '../PolicyEngine'
import type {
  BookedServiceLine,
  CancellationReason,
  CancellationScope,
  PolicyQuote,
} from '../types'

export type RefundConversationQueryKind =
  | 'cancel_refund_quote'
  | 'cancel_hotel_only'
  | 'flight_delay_policy'
  | 'deposit_refund'
  | 'cancel_after_checkin'
  | 'airline_cancels'
  | 'one_traveler_cancels'

export function detectRefundConversationQuery(
  userText: string,
): RefundConversationQueryKind | null {
  const lower = userText.toLowerCase().trim()

  if (
    /cancel only the hotel|hotel only|just the hotel/.test(lower)
    || /ألغي الفندق فقط/.test(lower)
  ) {
    return 'cancel_hotel_only'
  }
  if (
    /what happens if my flight is delayed|flight (is )?delayed|delay.*refund/.test(lower)
    || /تأخير الرحلة/.test(lower)
  ) {
    return 'flight_delay_policy'
  }
  if (
    /lose my deposit|deposit refund|will i (get|lose) (my )?deposit/.test(lower)
    || /العربون|الوديعة/.test(lower)
  ) {
    return 'deposit_refund'
  }
  if (
    /cancel after check-?in|after check in|early departure/.test(lower)
    || /بعد تسجيل الوصول/.test(lower)
  ) {
    return 'cancel_after_checkin'
  }
  if (
    /airline cancels|if the airline cancel|carrier cancel/.test(lower)
    || /إلغاء من شركة الطيران/.test(lower)
  ) {
    return 'airline_cancels'
  }
  if (
    /only one (traveler|passenger) cancels|one of us cancels|cancel one (traveler|passenger)/.test(
      lower,
    )
    || /مسافر واحد/.test(lower)
  ) {
    return 'one_traveler_cancels'
  }
  if (
    /if i cancel now|how much will i get back|cancel.*refund|refund if i cancel|can i cancel/.test(
      lower,
    )
    || /كم سأسترد|إذا ألغيت/.test(lower)
  ) {
    return 'cancel_refund_quote'
  }
  return null
}

export function answerRefundQuery(input: {
  kind: RefundConversationQueryKind
  engine: PolicyEngine
  tripId: string
  userId: string
  lines: BookedServiceLine[]
  currency: string
  platformFee?: number
  locale?: 'ar' | 'en'
}): string {
  const quote = buildQuoteForKind(input)
  return quote.simpleExplanation
}

export function shouldHandleRefundQueries(options?: {
  refundPolicyEngineEnabled?: boolean
}): boolean {
  return isRefundPolicyEngineEnabled(options)
}

function buildQuoteForKind(input: {
  kind: RefundConversationQueryKind
  engine: PolicyEngine
  tripId: string
  userId: string
  lines: BookedServiceLine[]
  currency: string
  platformFee?: number
}): PolicyQuote {
  const base = {
    tripId: input.tripId,
    userId: input.userId,
    currency: input.currency,
    lines: input.lines,
    platformFee: input.platformFee ?? 40,
    passengersTotal: 2,
    passengersCancelling: 1,
  }

  const map: Record<
    RefundConversationQueryKind,
    { scope: CancellationScope; reason: CancellationReason; extras?: Partial<Parameters<PolicyEngine['quote']>[0]> }
  > = {
    cancel_refund_quote: { scope: 'full_booking', reason: 'customer_request' },
    cancel_hotel_only: { scope: 'hotel_only', reason: 'customer_request' },
    flight_delay_policy: {
      scope: 'flight_only',
      reason: 'flight_delay',
      extras: { flightDelayed: true },
    },
    deposit_refund: { scope: 'car_only', reason: 'customer_request' },
    cancel_after_checkin: {
      scope: 'hotel_only',
      reason: 'after_check_in',
      extras: { checkedIn: true },
    },
    airline_cancels: {
      scope: 'flight_only',
      reason: 'airline_initiated',
      extras: { airlineCancelled: true },
    },
    one_traveler_cancels: {
      scope: 'one_passenger',
      reason: 'customer_request',
      extras: { passengersTotal: 2, passengersCancelling: 1 },
    },
  }

  const cfg = map[input.kind]
  return input.engine.quote({
    ...base,
    scope: cfg.scope,
    reason: cfg.reason,
    ...cfg.extras,
  })
}
