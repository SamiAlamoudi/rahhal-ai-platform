/**
 * Resolve a prior Payments session for confirmation / document turns.
 * Alpha wiring — keeps payment + documents visible across conversation turns.
 */

import { getDefaultPaymentsPlatformEngine } from './orchestrator'
import { getDefaultPaymentSessionStore } from './sessionStore'
import { isPaymentSuccess } from './lifecycle'
import type { PaymentsPlatformResult } from './types'

export function shouldShowPaymentSummary(userText?: string | null): boolean {
  const text = (userText || '').toLowerCase()
  if (!text) return false
  return (
    /ملخص التأكيد|المستندات|التذاكر|عرض التأكيد|تأكيد الحجز/.test(text)
    || /\b(confirmation summary|show (tickets|documents|confirmation)|download itinerary)\b/.test(text)
  )
}

/** Latest successful (or any) payment result for this conversation/user. */
export function findLatestPaymentsResult(userId: string): PaymentsPlatformResult | null {
  const sessions = getDefaultPaymentSessionStore()
    .list()
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const prefer = sessions.find((s) => isPaymentSuccess(s.status)) ?? sessions[0]
  if (!prefer) return null

  const engine = getDefaultPaymentsPlatformEngine()
  const documents = engine.documents.list(prefer.id)
  const tickets = engine.listTickets(prefer.id)
  const refunds = engine.refunds.list(prefer.id)

  return {
    snapshot: {
      version: 1,
      paymentSessionId: prefer.id,
      status: prefer.status,
      method: prefer.method,
      providerId: prefer.providerId,
      amount: prefer.capturedAmount || prefer.amount,
      currency: prefer.currency,
      ticketCount: tickets.length,
      documentCount: documents.length,
      refundCount: refunds.length,
      riskScore: prefer.fraud?.riskScore ?? 0,
      durationMs: 0,
      resumed: true,
      idempotentReplay: true,
    },
    session: prefer,
    tickets,
    documents,
    refunds,
    events: [],
    audit: engine.audit.list(prefer.id),
    paymentFacts: [
      `Payment ${prefer.id} status=${prefer.status}`,
      `Amount ${prefer.capturedAmount || prefer.amount} ${prefer.currency}`,
      documents.length ? `Documents available: ${documents.length}` : 'No documents yet',
    ],
  }
}
