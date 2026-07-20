/**
 * Sprint 58 — Payments & Ticketing Platform tests.
 * Mock adapters only — no external network / real gateways.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createBookingExecutionEngine,
  resetDefaultBookingExecutionEngine,
  resetDefaultBookingSessionStore,
} from '../agent/bookingExecution'
import { createBookingProviderRegistry } from '../agent/bookingIntelligence'
import type { BookingProvider } from '../agent/bookingIntelligence/types'
import {
  canTransitionPayment,
  createDefaultMockPaymentProviders,
  createPaymentsPlatformEngine,
  FraudGuard,
  isPaymentsEnabled,
  isRefundsEnabled,
  isTicketingEnabled,
  normalizeMoney,
  PaymentProviderRegistry,
  resetDefaultPaymentSessionStore,
  resetDefaultPaymentsPlatformEngine,
  shouldRunPayments,
  detectPaymentMethod,
} from '../agent/paymentsPlatform'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'

function money(amount: number, currency = 'SAR') {
  return { amount, currency }
}

function mockBookingProvider(domain: BookingProvider['domain'], providerId: string): BookingProvider {
  return {
    providerId,
    domain,
    displayName: providerId,
    isAvailable: () => true,
    async search() {
      return [{
        id: `${providerId}:offer`,
        domain,
        providerId,
        title: domain,
        price: money(500),
      }]
    },
    async details(id) {
      return {
        id,
        domain,
        providerId,
        title: domain,
        price: money(500),
      }
    },
    async availability() {
      return { available: true }
    },
    async price() {
      return money(500)
    },
    async book(offerId) {
      return { ok: true, confirmationId: `conf-${offerId}` }
    },
    async cancel() {
      return { ok: true }
    },
  }
}

describe('Sprint 58 — Payments & Ticketing Platform', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultPaymentSessionStore()
    resetDefaultPaymentsPlatformEngine()
    resetDefaultBookingSessionStore()
    resetDefaultBookingExecutionEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultPaymentSessionStore()
    resetDefaultPaymentsPlatformEngine()
  })

  describe('feature flags', () => {
    it('registers payments/ticketing/refunds enabled by default', () => {
      const registry = getFeatureRegistry()
      expect(registry.isEnabled('ai.payments')).toBe(true)
      expect(registry.isEnabled('ai.ticketing')).toBe(true)
      expect(registry.isEnabled('ai.refunds')).toBe(true)
      expect(isPaymentsEnabled()).toBe(true)
      expect(isTicketingEnabled()).toBe(true)
      expect(isRefundsEnabled()).toBe(true)
    })
  })

  describe('lifecycle + providers', () => {
    it('supports all payment methods via common mock interface', () => {
      const providers = createDefaultMockPaymentProviders()
      expect(providers.map((p) => p.method).sort()).toEqual([
        'apple_pay',
        'bank_transfer',
        'card',
        'google_pay',
        'mada',
        'stc_pay',
        'tabby',
        'tamara',
      ].sort())
      expect(canTransitionPayment('pending', 'authorized')).toBe(true)
      expect(canTransitionPayment('authorized', 'captured')).toBe(true)
      expect(canTransitionPayment('captured', 'refund_pending')).toBe(true)
      expect(canTransitionPayment('refunded', 'pending')).toBe(false)
    })
  })

  describe('currency engine', () => {
    it('normalizes FX, taxes, fees, commissions, and rounding', () => {
      const breakdown = normalizeMoney({
        amount: 100,
        currency: 'USD',
        targetCurrency: 'SAR',
      })
      expect(breakdown.normalizedCurrency).toBe('SAR')
      expect(breakdown.normalizedAmount).toBeGreaterThan(100)
      expect(breakdown.taxes).toBeGreaterThan(0)
      expect(breakdown.fees).toBeGreaterThan(0)
      expect(breakdown.providerCommission).toBeGreaterThan(0)
      expect(breakdown.roundedAmount).toBeGreaterThan(breakdown.normalizedAmount)
    })
  })

  describe('fraud protection', () => {
    it('blocks duplicate payment keys and velocity abuse', () => {
      const guard = new FraudGuard({ maxPayments: 2, maxAmount: 1000, windowMs: 60_000 })
      const first = guard.assess({
        userId: 'u1',
        amount: 100,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'k1',
      })
      expect(first.allowed).toBe(true)
      const dup = guard.assess({
        userId: 'u1',
        amount: 100,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'k1',
      })
      expect(dup.duplicateDetected).toBe(true)
      expect(dup.allowed).toBe(false)

      guard.assess({
        userId: 'u2',
        amount: 100,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'a',
      })
      guard.assess({
        userId: 'u2',
        amount: 100,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'b',
      })
      const velocity = guard.assess({
        userId: 'u2',
        amount: 100,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'c',
      })
      expect(velocity.velocityExceeded).toBe(true)
      expect(velocity.allowed).toBe(false)
    })
  })

  describe('payment success + ticketing + documents', () => {
    it('authorizes, captures, issues tickets, and stores documents', async () => {
      const bookingEngine = createBookingExecutionEngine()
      const registry = createBookingProviderRegistry([
        mockBookingProvider('flights', 'flight_p'),
        mockBookingProvider('hotels', 'hotel_p'),
      ])
      const execution = await bookingEngine.run({
        userId: 'u1',
        registry,
        idempotencyKey: 'book-pay-1',
        items: [
          { domain: 'flights', offerId: 'flight_p:offer', providerId: 'flight_p', title: 'F', price: money(900) },
          { domain: 'hotels', offerId: 'hotel_p:offer', providerId: 'hotel_p', title: 'H', price: money(500) },
        ],
      })
      expect(execution.snapshot.confirmedCount).toBe(2)

      const events: string[] = []
      const engine = createPaymentsPlatformEngine()
      engine.events.on('*', (e) => events.push(e.type))

      const paid = await engine.run({
        userId: 'u1',
        amount: 1400,
        currency: 'SAR',
        method: 'mada',
        bookingExecution: execution,
        idempotencyKey: 'pay-1',
      })

      expect(paid.snapshot.status).toBe('captured')
      expect(paid.snapshot.method).toBe('mada')
      expect(paid.snapshot.ticketCount).toBe(2)
      expect(paid.tickets.some((t) => t.kind === 'flight')).toBe(true)
      expect(paid.tickets.some((t) => t.kind === 'hotel_voucher')).toBe(true)
      expect(paid.documents.some((d) => d.kind === 'eticket')).toBe(true)
      expect(paid.documents.some((d) => d.kind === 'voucher')).toBe(true)
      expect(paid.documents.some((d) => d.kind === 'invoice')).toBe(true)
      expect(paid.documents.some((d) => d.kind === 'receipt')).toBe(true)
      expect(paid.documents.some((d) => d.kind === 'confirmation_pdf')).toBe(true)
      expect(paid.documents[0]?.downloadUrl).toContain('https://docs.rahhal.local/')
      expect(events).toEqual(expect.arrayContaining([
        'PaymentStarted',
        'Authorized',
        'Captured',
        'TicketIssued',
      ]))
      expect(paid.audit.some((a) => a.action === 'captured')).toBe(true)
    })
  })

  describe('idempotency, resume, retry, failure', () => {
    it('replays completed payment for duplicate idempotency key', async () => {
      const engine = createPaymentsPlatformEngine()
      const first = await engine.run({
        userId: 'u1',
        amount: 200,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'dup-pay',
      })
      const second = await engine.run({
        userId: 'u1',
        amount: 200,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'dup-pay',
      })
      expect(second.snapshot.idempotentReplay).toBe(true)
      expect(second.snapshot.paymentSessionId).toBe(first.snapshot.paymentSessionId)
    })

    it('resumes an authorized session through capture', async () => {
      const providers = new PaymentProviderRegistry(
        createDefaultMockPaymentProviders({ card: { failCapture: true } }),
      )
      const engine = createPaymentsPlatformEngine({ providers })
      const first = await engine.run({
        userId: 'u1',
        amount: 300,
        currency: 'SAR',
        method: 'card',
        idempotencyKey: 'resume-pay',
      })
      // With failCapture, authorize succeeds then capture fails — status failed
      expect(first.snapshot.status).toBe('failed')

      // Manual resume path: seed authorized session
      // Need provider that can capture — use fresh engine with working providers
      const engine2 = createPaymentsPlatformEngine()
      // Pre-authorize on engine2 adapter
      const adapter = engine2.providers.get('card')!
      const auth = await adapter.authorize({
        amount: 300,
        currency: 'SAR',
        method: 'card',
        customerId: 'u1',
        idempotencyKey: 'resume-pay:auth',
      })
      engine2.sessions.save({
        ...first.session,
        id: 'pay_resume_test',
        idempotencyKey: 'resume-unique',
        providerRef: auth.providerRef,
        providerId: 'mock_card',
        status: 'authorized',
        authorizedAmount: 300,
        resumeCursor: 'capture',
        lastError: null,
      })
      const resumed = await engine2.run({
        userId: 'u1',
        amount: 300,
        currency: 'SAR',
        method: 'card',
        resumeSessionId: 'pay_resume_test',
        idempotencyKey: 'resume-unique',
      })
      expect(resumed.snapshot.resumed).toBe(true)
      expect(resumed.snapshot.status).toBe('captured')
    })

    it('expires payment sessions past expiresAt', async () => {
      let now = 1_000
      const engine = createPaymentsPlatformEngine()
      const result = await engine.run({
        userId: 'u1',
        amount: 100,
        currency: 'SAR',
        method: 'stc_pay',
        idempotencyKey: 'exp-pay',
        expiresInMs: 50,
        now: () => now,
      })
      expect(result.snapshot.status).toBe('captured')
      now = 2_000
      const expired = await engine.run({
        userId: 'u1',
        amount: 100,
        currency: 'SAR',
        method: 'stc_pay',
        idempotencyKey: 'exp-pay-2',
        expiresInMs: 10,
        now: () => now,
      })
      // Create then immediately expire by using now past expiry on a pending session
      const pending = engine.sessions.get(expired.session.id)!
      engine.sessions.save({
        ...pending,
        status: 'pending',
        resumeCursor: 'authorize',
        expiresAt: new Date(1_500).toISOString(),
        capturedAmount: 0,
        providerRef: null,
      })
      const again = await engine.run({
        userId: 'u1',
        amount: 100,
        currency: 'SAR',
        method: 'stc_pay',
        resumeSessionId: pending.id,
        idempotencyKey: 'exp-pay-2',
        now: () => 3_000,
      })
      expect(again.snapshot.status).toBe('expired')
    })
  })

  describe('refunds + chargeback', () => {
    it('processes full refund with timeline and document', async () => {
      const engine = createPaymentsPlatformEngine()
      const paid = await engine.run({
        userId: 'u1',
        amount: 400,
        currency: 'SAR',
        method: 'tabby',
        idempotencyKey: 'refund-pay',
      })
      expect(paid.snapshot.status).toBe('captured')
      const { refund, session } = await engine.refund({
        sessionId: paid.session.id,
        providerCancellation: true,
        reason: 'customer_request',
      })
      expect(refund.kind).toBe('full')
      expect(refund.status).toBe('refunded')
      expect(refund.timeline.length).toBeGreaterThan(1)
      expect(session.status).toBe('refunded')
      expect(engine.documents.list(paid.session.id).some((d) => d.kind === 'refund')).toBe(true)

      const charged = createPaymentsPlatformEngine()
      const paid2 = await charged.run({
        userId: 'u1',
        amount: 150,
        currency: 'SAR',
        method: 'tamara',
        idempotencyKey: 'cb-pay',
      })
      const cb = charged.openChargeback(paid2.session.id)
      expect(cb.status).toBe('chargeback')
    })

    it('supports partial refunds', async () => {
      const engine = createPaymentsPlatformEngine()
      const paid = await engine.run({
        userId: 'u1',
        amount: 1000,
        currency: 'SAR',
        method: 'apple_pay',
        idempotencyKey: 'partial-refund',
      })
      const { refund } = await engine.refund({
        sessionId: paid.session.id,
        amount: 250,
      })
      expect(refund.kind).toBe('partial')
      expect(refund.amount).toBe(250)
    })
  })

  describe('bridge helpers', () => {
    it('detects methods and pay cues', () => {
      expect(detectPaymentMethod('pay with Apple Pay')).toBe('apple_pay')
      expect(detectPaymentMethod('مدى')).toBe('mada')
      expect(shouldRunPayments({
        bookingExecutionStatus: 'confirmed',
        userText: 'pay now',
      })).toBe(true)
      expect(shouldRunPayments({
        bookingExecutionStatus: 'confirmed',
        userText: 'just browsing',
      })).toBe(false)
    })
  })
})
