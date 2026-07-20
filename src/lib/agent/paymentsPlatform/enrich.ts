/**
 * Enrich trip plan after Booking Execution with Payments & Ticketing — Sprint 58.
 */

import type { BookingExecutionResult } from '../bookingExecution/types'
import type { AgentMemory, TripPlan } from '../types'
import {
  amountFromBookingExecution,
  detectPaymentMethod,
  shouldRunPayments,
} from './bridge'
import { isPaymentsEnabled, isTicketingEnabled } from './feature'
import { runPaymentsPlatform } from './orchestrator'
import type { PaymentsPlatformResult } from './types'

export async function enrichWithPaymentsPlatform(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  userId: string
  bookingExecution: BookingExecutionResult | null
  userText?: string
  enabled?: boolean
  ticketingEnabled?: boolean
  signal?: AbortSignal
}): Promise<{
  tripPlan: TripPlan
  payments: PaymentsPlatformResult | null
}> {
  if (!isPaymentsEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, payments: null }
  }
  if (!input.bookingExecution) {
    return { tripPlan: input.tripPlan, payments: null }
  }
  if (input.bookingExecution.snapshot.confirmedCount <= 0) {
    return { tripPlan: input.tripPlan, payments: null }
  }
  if (!shouldRunPayments({
    userText: input.userText,
    intent: input.memory.lastIntent,
    bookingExecutionStatus: input.bookingExecution.snapshot.status,
  })) {
    return { tripPlan: input.tripPlan, payments: null }
  }

  const { amount, currency } = amountFromBookingExecution(input.bookingExecution)
  if (amount <= 0) return { tripPlan: input.tripPlan, payments: null }

  const result = await runPaymentsPlatform({
    userId: input.userId,
    amount,
    currency,
    method: detectPaymentMethod(input.userText),
    bookingExecution: input.bookingExecution,
    bookingExecutionSessionId: input.bookingExecution.snapshot.sessionId,
    ticketingEnabled: isTicketingEnabled({ enabled: input.ticketingEnabled }),
    signal: input.signal,
  })

  const notes = [
    ...input.tripPlan.notes,
    ...result.paymentFacts.slice(0, 4).map((fact) => `Payment: ${fact}`),
  ]

  return {
    tripPlan: { ...input.tripPlan, notes },
    payments: result,
  }
}
