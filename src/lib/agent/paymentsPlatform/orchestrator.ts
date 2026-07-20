/**
 * Payment Orchestrator — Sprint 58.
 * Booking Execution requests payment → authorize → capture → ticketing → documents.
 */

import type { BookingExecutionResult } from '../bookingExecution/types'
import { normalizeMoney } from './currencyEngine'
import { DocumentCenter } from './documents'
import { createPaymentPlatformEvent, PaymentAuditTrail, PaymentEventBus } from './events'
import { isPaymentsEnabled, isTicketingEnabled } from './feature'
import { FraudGuard } from './fraud'
import { assertPaymentTransition, isPaymentSuccess } from './lifecycle'
import { PaymentProviderRegistry } from './providers'
import { RefundEngine } from './refunds'
import {
  getDefaultPaymentSessionStore,
  PaymentSessionStore,
} from './sessionStore'
import { issueTicketsFromExecution } from './ticketing'
import type {
  PaymentMethod,
  PaymentNotificationEvent,
  PaymentSession,
  PaymentsPlatformResult,
  UnifiedTicket,
  DocumentRecord,
  RefundRecord,
} from './types'

export type RunPaymentInput = {
  userId: string
  amount: number
  currency: string
  method: PaymentMethod
  bookingExecution?: BookingExecutionResult | null
  bookingExecutionSessionId?: string | null
  idempotencyKey?: string
  sessionId?: string
  resumeSessionId?: string
  expiresInMs?: number
  targetCurrency?: string
  enabled?: boolean
  ticketingEnabled?: boolean
  signal?: AbortSignal
  now?: () => number
}

export type PaymentsPlatformEngine = {
  events: PaymentEventBus
  audit: PaymentAuditTrail
  sessions: PaymentSessionStore
  documents: DocumentCenter
  refunds: RefundEngine
  fraud: FraudGuard
  providers: PaymentProviderRegistry
  run(input: RunPaymentInput): Promise<PaymentsPlatformResult>
  listTickets(sessionId: string): UnifiedTicket[]
  refund(input: {
    sessionId: string
    amount?: number
    providerCancellation?: boolean
    reason?: string
    enabled?: boolean
    now?: () => number
  }): Promise<{ session: PaymentSession; refund: RefundRecord; result: PaymentsPlatformResult }>
  openChargeback(sessionId: string, now?: () => number): PaymentSession
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function buildFacts(session: PaymentSession, tickets: UnifiedTicket[]): string[] {
  const facts = [
    `Payment ${session.id} status=${session.status} via ${session.method}`,
    `Amount ${session.capturedAmount || session.amount} ${session.currency}`,
  ]
  if (session.fraud) facts.push(`Risk score ${session.fraud.riskScore.toFixed(2)}`)
  if (tickets.length) facts.push(`Tickets issued: ${tickets.length}`)
  return facts
}

export function createPaymentsPlatformEngine(options?: {
  sessions?: PaymentSessionStore
  providers?: PaymentProviderRegistry
  events?: PaymentEventBus
  audit?: PaymentAuditTrail
  documents?: DocumentCenter
  fraud?: FraudGuard
}): PaymentsPlatformEngine {
  const sessions = options?.sessions ?? getDefaultPaymentSessionStore()
  const providers = options?.providers ?? new PaymentProviderRegistry()
  const events = options?.events ?? new PaymentEventBus()
  const audit = options?.audit ?? new PaymentAuditTrail()
  const documents = options?.documents ?? new DocumentCenter()
  const fraud = options?.fraud ?? new FraudGuard()
  const refunds = new RefundEngine(providers)
  const ticketsBySession = new Map<string, UnifiedTicket[]>()

  const engine: PaymentsPlatformEngine = {
    events,
    audit,
    sessions,
    documents,
    refunds,
    fraud,
    providers,

    listTickets(sessionId) {
      return [...(ticketsBySession.get(sessionId) ?? [])]
    },

    async run(input) {
      if (!isPaymentsEnabled({ enabled: input.enabled })) {
        throw new Error('payments_disabled')
      }
      const now = input.now ?? (() => Date.now())
      const started = now()
      const collected: PaymentNotificationEvent[] = []
      const emit = (event: PaymentNotificationEvent) => {
        collected.push(event)
        events.emit(event)
      }

      const idempotencyKey =
        input.idempotencyKey
        ?? `pay_${input.userId}_${input.method}_${input.amount}_${input.currency}`

      const existing = sessions.getByIdempotencyKey(idempotencyKey)
      if (existing && !input.resumeSessionId) {
        if (
          isPaymentSuccess(existing.status)
          || existing.status === 'failed'
          || existing.status === 'cancelled'
          || existing.status === 'expired'
          || existing.status === 'refunded'
          || existing.resumeCursor === 'done'
        ) {
          const tickets = ticketsBySession.get(existing.id) ?? []
          return finalize({
            session: existing,
            tickets,
            documents: documents.list(existing.id),
            refunds: refunds.list(existing.id),
            events: collected,
            audit,
            now,
            started,
            resumed: false,
            idempotentReplay: true,
          })
        }
      }

      let session: PaymentSession
      let resumed = false

      if (input.resumeSessionId) {
        const prior = sessions.get(input.resumeSessionId)
        if (!prior) throw new Error('payment_session_not_found')
        session = prior
        resumed = true
        audit.record({
          sessionId: session.id,
          action: 'payment_resumed',
          fromStatus: session.status,
          toStatus: session.status,
          now,
        })
      } else {
        const breakdown = normalizeMoney({
          amount: input.amount,
          currency: input.currency,
          targetCurrency: input.targetCurrency ?? 'SAR',
        })
        session = {
          id: input.sessionId ?? createId('pay'),
          userId: input.userId,
          bookingExecutionSessionId:
            input.bookingExecutionSessionId
            ?? input.bookingExecution?.snapshot.sessionId
            ?? null,
          amount: breakdown.roundedAmount,
          currency: breakdown.normalizedCurrency,
          method: input.method,
          providerId: null,
          status: 'pending',
          providerRef: null,
          idempotencyKey,
          createdAt: new Date(now()).toISOString(),
          updatedAt: new Date(now()).toISOString(),
          expiresAt: new Date(now() + (input.expiresInMs ?? 30 * 60_000)).toISOString(),
          authorizedAmount: 0,
          capturedAmount: 0,
          refundedAmount: 0,
          retryCount: 0,
          resumeCursor: 'authorize',
          lastError: null,
          breakdown,
          fraud: null,
        }
        sessions.save(session)
        emit(createPaymentPlatformEvent('PaymentStarted', session.id, {
          method: session.method,
          amount: session.amount,
        }, now))
        audit.record({
          sessionId: session.id,
          action: 'payment_started',
          fromStatus: null,
          toStatus: 'pending',
          detail: { financial: session.breakdown },
          now,
        })
      }

      if (Date.parse(session.expiresAt) <= now()) {
        session = { ...session, status: 'expired', updatedAt: new Date(now()).toISOString(), resumeCursor: 'done' }
        sessions.save(session)
        return finalize({
          session,
          tickets: ticketsBySession.get(session.id) ?? [],
          documents: documents.list(session.id),
          refunds: refunds.list(session.id),
          events: collected,
          audit,
          now,
          started,
          resumed,
          idempotentReplay: false,
        })
      }

      const fraudAssessment = fraud.assess({
        userId: input.userId,
        amount: session.amount,
        currency: session.currency,
        method: session.method,
        idempotencyKey: session.idempotencyKey,
        providerVerified: true,
        now,
      })
      session = { ...session, fraud: fraudAssessment }
      if (!fraudAssessment.allowed) {
        assertPaymentTransition(session.status, 'failed')
        session = {
          ...session,
          status: 'failed',
          lastError: fraudAssessment.reasons.join(','),
          resumeCursor: 'done',
          updatedAt: new Date(now()).toISOString(),
        }
        sessions.save(session)
        emit(createPaymentPlatformEvent('PaymentFailed', session.id, {
          reasons: fraudAssessment.reasons,
        }, now))
        audit.record({
          sessionId: session.id,
          action: 'fraud_blocked',
          error: session.lastError,
          fromStatus: 'pending',
          toStatus: 'failed',
          detail: { riskScore: fraudAssessment.riskScore },
          now,
        })
        return finalize({
          session,
          tickets: [],
          documents: documents.list(session.id),
          refunds: refunds.list(session.id),
          events: collected,
          audit,
          now,
          started,
          resumed,
          idempotentReplay: false,
        })
      }

      const adapter = providers.get(session.method)
      if (!adapter) {
        session = {
          ...session,
          status: 'failed',
          lastError: 'provider_unavailable',
          resumeCursor: 'done',
          updatedAt: new Date(now()).toISOString(),
        }
        sessions.save(session)
        emit(createPaymentPlatformEvent('PaymentFailed', session.id, undefined, now))
        return finalize({
          session,
          tickets: [],
          documents: documents.list(session.id),
          refunds: refunds.list(session.id),
          events: collected,
          audit,
          now,
          started,
          resumed,
          idempotentReplay: false,
        })
      }

      // Authorize
      if (session.resumeCursor === 'authorize') {
        const auth = await adapter.authorize({
          amount: session.amount,
          currency: session.currency,
          method: session.method,
          customerId: input.userId,
          idempotencyKey: `${session.idempotencyKey}:auth`,
          description: 'Rahhal booking payment',
          signal: input.signal,
        })
        session = {
          ...session,
          providerId: adapter.providerId,
          retryCount: session.retryCount + (auth.ok ? 0 : 1),
          updatedAt: new Date(now()).toISOString(),
        }
        if (!auth.ok || !auth.providerRef) {
          session = {
            ...session,
            status: 'failed',
            lastError: auth.error || 'authorize_failed',
            resumeCursor: 'done',
          }
          sessions.save(session)
          emit(createPaymentPlatformEvent('PaymentFailed', session.id, { stage: 'authorize' }, now))
          audit.record({
            sessionId: session.id,
            action: 'authorize_failed',
            provider: adapter.providerId,
            latencyMs: auth.latencyMs,
            error: session.lastError,
            fromStatus: 'pending',
            toStatus: 'failed',
            detail: { providerResponse: auth.raw },
            now,
          })
          return finalize({
            session,
            tickets: [],
            documents: documents.list(session.id),
            refunds: refunds.list(session.id),
            events: collected,
            audit,
            now,
            started,
            resumed,
            idempotentReplay: false,
          })
        }
        assertPaymentTransition('pending', 'authorized')
        session = {
          ...session,
          status: 'authorized',
          providerRef: auth.providerRef,
          authorizedAmount: auth.authorizedAmount ?? session.amount,
          resumeCursor: 'capture',
        }
        sessions.save(session)
        emit(createPaymentPlatformEvent('Authorized', session.id, {
          providerRef: auth.providerRef,
        }, now))
        audit.record({
          sessionId: session.id,
          action: 'authorized',
          provider: adapter.providerId,
          latencyMs: auth.latencyMs,
          fromStatus: 'pending',
          toStatus: 'authorized',
          detail: { providerResponse: auth.raw },
          now,
        })
      }

      // Capture
      if (session.resumeCursor === 'capture' && session.providerRef) {
        const capture = await adapter.capture({
          amount: session.amount,
          currency: session.currency,
          method: session.method,
          customerId: input.userId,
          idempotencyKey: `${session.idempotencyKey}:capture`,
          providerRef: session.providerRef,
          signal: input.signal,
        })
        if (!capture.ok) {
          session = {
            ...session,
            status: 'failed',
            lastError: capture.error || 'capture_failed',
            resumeCursor: 'done',
            retryCount: session.retryCount + 1,
            updatedAt: new Date(now()).toISOString(),
          }
          sessions.save(session)
          emit(createPaymentPlatformEvent('PaymentFailed', session.id, { stage: 'capture' }, now))
          audit.record({
            sessionId: session.id,
            action: 'capture_failed',
            provider: adapter.providerId,
            latencyMs: capture.latencyMs,
            error: session.lastError,
            fromStatus: 'authorized',
            toStatus: 'failed',
            now,
          })
          return finalize({
            session,
            tickets: [],
            documents: documents.list(session.id),
            refunds: refunds.list(session.id),
            events: collected,
            audit,
            now,
            started,
            resumed,
            idempotentReplay: false,
          })
        }
        const nextStatus = capture.status === 'partially_captured'
          ? 'partially_captured'
          : 'captured'
        assertPaymentTransition('authorized', nextStatus)
        session = {
          ...session,
          status: nextStatus,
          capturedAmount: capture.capturedAmount ?? session.amount,
          resumeCursor: 'ticket',
          updatedAt: new Date(now()).toISOString(),
        }
        sessions.save(session)
        emit(createPaymentPlatformEvent('Captured', session.id, {
          amount: session.capturedAmount,
        }, now))
        audit.record({
          sessionId: session.id,
          action: 'captured',
          provider: adapter.providerId,
          latencyMs: capture.latencyMs,
          fromStatus: 'authorized',
          toStatus: nextStatus,
          detail: { financial: { captured: session.capturedAmount, currency: session.currency } },
          now,
        })
      }

      // Ticketing after successful capture
      let tickets: UnifiedTicket[] = ticketsBySession.get(session.id) ?? []
      if (
        session.resumeCursor === 'ticket'
        && isTicketingEnabled({ enabled: input.ticketingEnabled })
        && input.bookingExecution
      ) {
        tickets = issueTicketsFromExecution({
          paymentSessionId: session.id,
          execution: input.bookingExecution,
          now,
        })
        const docs = documents.storeTicketBundle({
          paymentSessionId: session.id,
          tickets,
          invoiceAmount: session.capturedAmount,
          currency: session.currency,
          now,
        })
        ticketsBySession.set(session.id, tickets)
        emit(createPaymentPlatformEvent('TicketIssued', session.id, {
          ticketCount: tickets.length,
          documentCount: docs.length,
        }, now))
        audit.record({
          sessionId: session.id,
          action: 'tickets_issued',
          fromStatus: session.status,
          toStatus: session.status,
          detail: { ticketHistory: tickets.map((t) => t.id), documentCount: docs.length },
          now,
        })
      }

      session = {
        ...session,
        resumeCursor: 'done',
        updatedAt: new Date(now()).toISOString(),
      }
      sessions.save(session)

      return finalize({
        session,
        tickets,
        documents: documents.list(session.id),
        refunds: refunds.list(session.id),
        events: collected,
        audit,
        now,
        started,
        resumed,
        idempotentReplay: false,
      })
    },

    async refund(input) {
      const now = input.now ?? (() => Date.now())
      const session = sessions.get(input.sessionId)
      if (!session) throw new Error('payment_session_not_found')
      assertPaymentTransition(session.status, 'refund_pending')
      let next: PaymentSession = {
        ...session,
        status: 'refund_pending',
        updatedAt: new Date(now()).toISOString(),
      }
      sessions.save(next)
      events.emit(createPaymentPlatformEvent('RefundStarted', next.id, {
        amount: input.amount ?? next.capturedAmount,
      }, now))
      audit.record({
        sessionId: next.id,
        action: 'refund_started',
        fromStatus: session.status,
        toStatus: 'refund_pending',
        now,
      })

      const refund = await refunds.startRefund({
        session: next,
        amount: input.amount,
        providerCancellation: input.providerCancellation,
        reason: input.reason,
        enabled: input.enabled,
        now,
      })

      if (refund.status === 'refunded') {
        documents.storeRefundDocument({
          paymentSessionId: next.id,
          refundId: refund.id,
          amount: refund.amount,
          currency: refund.currency,
          now,
        })
        next = {
          ...next,
          status: 'refunded',
          refundedAmount: next.refundedAmount + refund.amount,
          updatedAt: new Date(now()).toISOString(),
        }
        sessions.save(next)
        events.emit(createPaymentPlatformEvent('RefundCompleted', next.id, {
          refundId: refund.id,
        }, now))
        audit.record({
          sessionId: next.id,
          action: 'refund_completed',
          fromStatus: 'refund_pending',
          toStatus: 'refunded',
          detail: { refundHistory: refund.timeline },
          now,
        })
      } else {
        next = {
          ...next,
          status: 'failed',
          lastError: 'refund_failed',
          updatedAt: new Date(now()).toISOString(),
        }
        sessions.save(next)
      }

      const result = finalize({
        session: next,
        tickets: ticketsBySession.get(next.id) ?? [],
        documents: documents.list(next.id),
        refunds: refunds.list(next.id),
        events: [],
        audit,
        now,
        started: now(),
        resumed: false,
        idempotentReplay: false,
      })
      return { session: next, refund, result }
    },

    openChargeback(sessionId, nowFn = () => Date.now()) {
      const session = sessions.get(sessionId)
      if (!session) throw new Error('payment_session_not_found')
      assertPaymentTransition(session.status, 'chargeback')
      const next: PaymentSession = {
        ...session,
        status: 'chargeback',
        updatedAt: new Date(nowFn()).toISOString(),
      }
      sessions.save(next)
      events.emit(createPaymentPlatformEvent('ChargebackOpened', next.id, undefined, nowFn))
      audit.record({
        sessionId: next.id,
        action: 'chargeback_opened',
        fromStatus: session.status,
        toStatus: 'chargeback',
        now: nowFn,
      })
      return next
    },
  }

  return engine
}

function finalize(input: {
  session: PaymentSession
  tickets: UnifiedTicket[]
  documents: DocumentRecord[]
  refunds: RefundRecord[]
  events: PaymentNotificationEvent[]
  audit: PaymentAuditTrail
  now: () => number
  started: number
  resumed: boolean
  idempotentReplay: boolean
}): PaymentsPlatformResult {
  return {
    snapshot: {
      version: 1,
      paymentSessionId: input.session.id,
      status: input.session.status,
      method: input.session.method,
      providerId: input.session.providerId,
      amount: input.session.capturedAmount || input.session.amount,
      currency: input.session.currency,
      ticketCount: input.tickets.length,
      documentCount: input.documents.length,
      refundCount: input.refunds.length,
      riskScore: input.session.fraud?.riskScore ?? 0,
      durationMs: input.now() - input.started,
      resumed: input.resumed,
      idempotentReplay: input.idempotentReplay,
    },
    session: input.session,
    tickets: input.tickets,
    documents: input.documents,
    refunds: input.refunds,
    events: input.events,
    audit: input.audit.list(input.session.id),
    paymentFacts: buildFacts(input.session, input.tickets),
  }
}

let defaultEngine: PaymentsPlatformEngine | null = null

export function getDefaultPaymentsPlatformEngine(): PaymentsPlatformEngine {
  if (!defaultEngine) defaultEngine = createPaymentsPlatformEngine()
  return defaultEngine
}

export function resetDefaultPaymentsPlatformEngine(): void {
  defaultEngine = null
}

export async function runPaymentsPlatform(
  input: RunPaymentInput,
): Promise<PaymentsPlatformResult> {
  return getDefaultPaymentsPlatformEngine().run(input)
}
