/**
 * Sprint 57 — Booking Execution Engine tests.
 * Mocked providers only — no external network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BookingAuditTrail,
  BookingEventBus,
  BookingSessionStore,
  ReservationManager,
  TransactionManager,
  canTransition,
  createBookingExecutionEngine,
  isBookingExecutionEnabled,
  isBookingResumeEnabled,
  isTransactionManagerEnabled,
  lineItemsFromBookingIntelligence,
  normalizeProviderBooking,
  resetDefaultBookingExecutionEngine,
  resetDefaultBookingSessionStore,
  shouldRunBookingExecution,
  withBookingStatus,
} from '../agent/bookingExecution'
import {
  createBookingProviderRegistry,
  resetDefaultBookingProviderRegistry,
  runBookingIntelligence,
} from '../agent/bookingIntelligence'
import type { BookingProvider } from '../agent/bookingIntelligence/types'
import { emptyMemory, emptyRequirements } from '../agent/types'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'

function money(amount: number, currency = 'SAR') {
  return { amount, currency }
}

function mockProvider(input: {
  providerId: string
  domain: BookingProvider['domain']
  book?: BookingProvider['book']
  cancel?: BookingProvider['cancel']
}): BookingProvider {
  const catalog = new Map<string, { price: number }>()
  return {
    providerId: input.providerId,
    domain: input.domain,
    displayName: input.providerId,
    isAvailable: () => true,
    async search(query) {
      const id = `${input.providerId}:offer`
      catalog.set(id, { price: 1000 })
      return [
        {
          id,
          domain: input.domain,
          providerId: input.providerId,
          title: `${input.domain} offer`,
          price: money(1000, query.budgetCurrency || 'SAR'),
        },
      ]
    },
    async details(offerId) {
      if (!catalog.has(offerId)) return null
      return {
        id: offerId,
        domain: input.domain,
        providerId: input.providerId,
        title: offerId,
        price: money(1000),
      }
    },
    async availability() {
      return { available: true, seatsOrRooms: 2 }
    },
    async price(offerId) {
      return catalog.has(offerId) ? money(1000) : null
    },
    book: input.book
      ?? (async (offerId) => ({ ok: true, confirmationId: `conf-${offerId}` })),
    cancel: input.cancel
      ?? (async (confirmationId) => ({ ok: true, error: confirmationId ? undefined : 'missing' })),
  }
}

describe('Sprint 57 — Booking Execution Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
    resetDefaultBookingSessionStore()
    resetDefaultBookingExecutionEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
    resetDefaultBookingSessionStore()
    resetDefaultBookingExecutionEngine()
  })

  describe('feature flags', () => {
    it('registers booking execution flags enabled by default', () => {
      const registry = getFeatureRegistry()
      expect(registry.isEnabled('ai.booking_execution')).toBe(true)
      expect(registry.isEnabled('ai.transaction_manager')).toBe(true)
      expect(registry.isEnabled('ai.booking_resume')).toBe(true)
      expect(isBookingExecutionEnabled()).toBe(true)
      expect(isTransactionManagerEnabled()).toBe(true)
      expect(isBookingResumeEnabled()).toBe(true)
      expect(isBookingExecutionEnabled({ enabled: false })).toBe(false)
    })
  })

  describe('lifecycle', () => {
    it('allows draft→pending→confirmed→ticketed and blocks illegal jumps', () => {
      expect(canTransition('draft', 'pending')).toBe(true)
      expect(canTransition('pending', 'confirmed')).toBe(true)
      expect(canTransition('confirmed', 'ticketed')).toBe(true)
      expect(canTransition('ticketed', 'draft')).toBe(false)
      expect(canTransition('cancelled', 'confirmed')).toBe(false)
    })
  })

  describe('unified booking normalize', () => {
    it('normalizes provider response into one booking model', () => {
      const booking = normalizeProviderBooking({
        sessionId: 's1',
        domain: 'flights',
        providerId: 'sim_flights_a',
        offerId: 'offer-1',
        confirmationId: 'sim-book-ABC123XYZ',
        reservationId: 'rsv_1',
        status: 'confirmed',
        travelers: [{ firstName: 'Sara', lastName: 'Ali' }],
        pricing: money(1200),
        title: 'RUH → DXB',
      })
      expect(booking.provider).toBe('sim_flights_a')
      expect(booking.confirmation).toContain('sim-book')
      expect(booking.pnr).toBeTruthy()
      expect(booking.reservationId).toBe('rsv_1')
      expect(booking.travelerInfo[0]?.firstName).toBe('Sara')
      expect(booking.pricing.amount).toBe(1200)
      expect(booking.taxes.amount).toBeGreaterThan(0)
      expect(booking.tickets.length).toBe(1)
      expect(booking.documents[0]?.type).toBe('eticket')
      const ticketed = withBookingStatus(booking, 'ticketed')
      expect(ticketed.status).toBe('ticketed')
      expect(ticketed.tickets[0]?.issuedAt).toBeTruthy()
    })
  })

  describe('success path + notifications + audit', () => {
    it('books domains independently and emits lifecycle events', async () => {
      const events: string[] = []
      const bus = new BookingEventBus()
      bus.on('*', (e) => events.push(e.type))
      const audit = new BookingAuditTrail()
      const engine = createBookingExecutionEngine({ events: bus, audit })
      const registry = createBookingProviderRegistry([
        mockProvider({ providerId: 'flight_a', domain: 'flights' }),
        mockProvider({ providerId: 'hotel_a', domain: 'hotels' }),
        mockProvider({ providerId: 'act_a', domain: 'activities' }),
        mockProvider({ providerId: 'car_a', domain: 'car_rental' }),
        mockProvider({ providerId: 'xfer_a', domain: 'airport_transfer' }),
        mockProvider({ providerId: 'ins_a', domain: 'insurance' }),
      ])

      const result = await engine.run({
        userId: 'u1',
        registry,
        idempotencyKey: 'success-1',
        items: [
          { domain: 'flights', offerId: 'flight_a:offer', providerId: 'flight_a', title: 'Flight', price: money(900) },
          { domain: 'hotels', offerId: 'hotel_a:offer', providerId: 'hotel_a', title: 'Hotel', price: money(500) },
          { domain: 'activities', offerId: 'act_a:offer', providerId: 'act_a', title: 'Tour', price: money(200) },
          { domain: 'transfers', offerId: 'xfer_a:offer', providerId: 'xfer_a', title: 'Transfer', price: money(80) },
          { domain: 'car_rental', offerId: 'car_a:offer', providerId: 'car_a', title: 'Car', price: money(300) },
          { domain: 'insurance', offerId: 'ins_a:offer', providerId: 'ins_a', title: 'Insurance', price: money(50) },
        ],
      })

      expect(result.snapshot.confirmedCount).toBe(6)
      expect(result.snapshot.status === 'confirmed' || result.snapshot.status === 'ticketed').toBe(true)
      expect(result.bookings.some((b) => b.domain === 'flights' && b.status === 'ticketed')).toBe(true)
      expect(events).toContain('BookingCreated')
      expect(events).toContain('BookingPending')
      expect(events).toContain('BookingConfirmed')
      expect(events).toContain('BookingCompleted')
      expect(audit.list(result.session.id).some((e) => e.action === 'book_confirmed')).toBe(true)
      expect(result.executionFacts.length).toBeGreaterThan(0)
    })
  })

  describe('retry + rollback + partial failure', () => {
    it('retries transient book failures then succeeds', async () => {
      let attempts = 0
      const provider = mockProvider({
        providerId: 'flight_retry',
        domain: 'flights',
        book: async (offerId) => {
          attempts += 1
          if (attempts < 2) throw new Error('transient')
          return { ok: true, confirmationId: `conf-${offerId}` }
        },
      })
      const engine = createBookingExecutionEngine()
      const result = await engine.run({
        userId: 'u1',
        registry: createBookingProviderRegistry([provider]),
        idempotencyKey: 'retry-1',
        items: [
          {
            domain: 'flights',
            offerId: 'flight_retry:offer',
            providerId: 'flight_retry',
            title: 'Flight',
            price: money(900),
          },
        ],
        transaction: { enabled: true, maxRetries: 2, retryDelayMs: 1 },
      })
      expect(attempts).toBe(2)
      expect(result.snapshot.confirmedCount).toBe(1)
    })

    it('rolls back confirmed items on all-or-nothing partial failure', async () => {
      const cancelled: string[] = []
      const flight = mockProvider({
        providerId: 'flight_ok',
        domain: 'flights',
        cancel: async (id) => {
          cancelled.push(id)
          return { ok: true }
        },
      })
      const hotel = mockProvider({
        providerId: 'hotel_fail',
        domain: 'hotels',
        book: async () => ({ ok: false, error: 'sold_out' }),
      })
      const engine = createBookingExecutionEngine()
      const result = await engine.run({
        userId: 'u1',
        registry: createBookingProviderRegistry([flight, hotel]),
        idempotencyKey: 'rollback-1',
        allOrNothing: true,
        items: [
          { domain: 'flights', offerId: 'flight_ok:offer', providerId: 'flight_ok', title: 'F', price: money(900) },
          { domain: 'hotels', offerId: 'hotel_fail:offer', providerId: 'hotel_fail', title: 'H', price: money(500) },
        ],
        transaction: { enabled: true },
      })
      expect(result.snapshot.rolledBack).toBe(true)
      expect(result.snapshot.status).toBe('failed')
      expect(cancelled.length).toBeGreaterThan(0)
      expect(result.events.some((e) => e.type === 'BookingCancelled')).toBe(true)
    })

    it('continues independent domains on partial provider failure', async () => {
      const flight = mockProvider({
        providerId: 'flight_ok2',
        domain: 'flights',
      })
      const hotel = mockProvider({
        providerId: 'hotel_fail2',
        domain: 'hotels',
        book: async () => ({ ok: false, error: 'unavailable' }),
      })
      const engine = createBookingExecutionEngine()
      const result = await engine.run({
        userId: 'u1',
        registry: createBookingProviderRegistry([flight, hotel]),
        idempotencyKey: 'partial-1',
        allOrNothing: false,
        items: [
          { domain: 'flights', offerId: 'flight_ok2:offer', providerId: 'flight_ok2', title: 'F', price: money(900) },
          { domain: 'hotels', offerId: 'hotel_fail2:offer', providerId: 'hotel_fail2', title: 'H', price: money(500) },
        ],
      })
      expect(result.snapshot.confirmedCount).toBe(1)
      expect(result.snapshot.failedCount).toBe(1)
      expect(result.snapshot.rolledBack).toBe(false)
      expect(result.events.some((e) => e.type === 'BookingFailed')).toBe(true)
    })
  })

  describe('idempotency + expiration + resume', () => {
    it('returns prior session for duplicate idempotency key', async () => {
      const engine = createBookingExecutionEngine()
      const registry = createBookingProviderRegistry([
        mockProvider({ providerId: 'flight_idemp', domain: 'flights' }),
      ])
      const first = await engine.run({
        userId: 'u1',
        registry,
        idempotencyKey: 'dup-key',
        items: [
          {
            domain: 'flights',
            offerId: 'flight_idemp:offer',
            providerId: 'flight_idemp',
            title: 'F',
            price: money(900),
          },
        ],
      })
      const second = await engine.run({
        userId: 'u1',
        registry,
        idempotencyKey: 'dup-key',
        items: [
          {
            domain: 'flights',
            offerId: 'flight_idemp:offer',
            providerId: 'flight_idemp',
            title: 'F',
            price: money(900),
          },
        ],
      })
      expect(second.snapshot.idempotentReplay).toBe(true)
      expect(second.snapshot.sessionId).toBe(first.snapshot.sessionId)
      expect(second.bookings[0]?.id).toBe(first.bookings[0]?.id)
    })

    it('expires sessions past expiresAt', async () => {
      let now = 1_000
      const engine = createBookingExecutionEngine()
      const registry = createBookingProviderRegistry([
        mockProvider({ providerId: 'flight_exp', domain: 'flights' }),
      ])
      const created = await engine.run({
        userId: 'u1',
        registry,
        idempotencyKey: 'exp-1',
        expiresInMs: 50,
        now: () => now,
        items: [
          {
            domain: 'flights',
            offerId: 'flight_exp:offer',
            providerId: 'flight_exp',
            title: 'F',
            price: money(900),
          },
        ],
      })
      expect(created.snapshot.status === 'confirmed' || created.snapshot.status === 'ticketed').toBe(true)

      // Force a draft/pending session for expireDue
      const store = engine.sessions
      const session = store.get(created.session.id)!
      store.save({
        ...session,
        status: 'pending',
        expiresAt: new Date(1_010).toISOString(),
        bookings: session.bookings.map((b) => ({ ...b, status: 'pending' })),
      })
      now = 2_000
      const expired = engine.expireDueSessions(() => now)
      expect(expired.length).toBe(1)
      expect(expired[0]?.status).toBe('expired')
    })

    it('resumes after interruption and recovers after restart', async () => {
      let failHotelOnce = true
      const flight = mockProvider({ providerId: 'flight_resume', domain: 'flights' })
      const hotel = mockProvider({
        providerId: 'hotel_resume',
        domain: 'hotels',
        book: async (offerId) => {
          if (failHotelOnce) {
            failHotelOnce = false
            return { ok: false, error: 'interrupted' }
          }
          return { ok: true, confirmationId: `conf-${offerId}` }
        },
      })
      const sessions = new BookingSessionStore()
      const reservations = new ReservationManager()
      const audit = new BookingAuditTrail()
      const engine = createBookingExecutionEngine({ sessions, reservations, audit })
      const registry = createBookingProviderRegistry([flight, hotel])

      const first = await engine.run({
        userId: 'u1',
        registry,
        idempotencyKey: 'resume-1',
        allOrNothing: false,
        resumeEnabled: true,
        items: [
          { domain: 'flights', offerId: 'flight_resume:offer', providerId: 'flight_resume', title: 'F', price: money(900) },
          { domain: 'hotels', offerId: 'hotel_resume:offer', providerId: 'hotel_resume', title: 'H', price: money(500) },
        ],
      })
      expect(first.snapshot.confirmedCount).toBe(1)
      expect(first.snapshot.failedCount).toBe(1)

      // Simulate restart recovery
      const persisted = sessions.persist({
        reservations: reservations.snapshot(),
        audit: audit.list(),
      })
      const sessions2 = new BookingSessionStore()
      const reservations2 = new ReservationManager()
      const audit2 = new BookingAuditTrail()
      sessions2.recover(persisted)
      reservations2.hydrate(persisted.reservations)
      audit2.hydrate(persisted.audit)
      const engine2 = createBookingExecutionEngine({
        sessions: sessions2,
        reservations: reservations2,
        audit: audit2,
      })

      // Resume remaining work by re-running with same key after clearing failed cursor manually
      const recovered = sessions2.get(first.session.id)!
      sessions2.save({
        ...recovered,
        resumeCursor: 1,
        failedDomains: [],
        bookings: recovered.bookings.filter((b) => b.domain === 'flights'),
        status: 'pending',
      })

      const resumed = await engine2.run({
        userId: 'u1',
        registry,
        resumeSessionId: first.session.id,
        resumeEnabled: true,
        idempotencyKey: 'resume-1',
        items: recovered.items,
      })
      expect(resumed.snapshot.resumed).toBe(true)
      expect(resumed.snapshot.confirmedCount).toBeGreaterThanOrEqual(1)
      expect(reservations2.snapshot().length).toBeGreaterThan(0)
    })
  })

  describe('reservation refresh + transaction timeout', () => {
    it('refreshes reservation tokens before expiry', () => {
      let now = 1_000
      const mgr = new ReservationManager({ now: () => now })
      const record = mgr.create({
        bookingId: 'b1',
        providerId: 'p1',
        domain: 'flights',
        expiresInMs: 10_000,
      })
      now = 5_000
      const refreshed = mgr.refresh(record.reservationId, 10_000)
      expect(refreshed?.token).not.toBe(record.token)
      expect(refreshed?.refreshedAt).toBeTruthy()
    })

    it('times out long-running book calls', async () => {
      const txn = new TransactionManager({
        enabled: true,
        timeoutMs: 20,
        maxRetries: 0,
        retryDelayMs: 1,
      })
      const result = await txn.runWithRetry('slow', async () => {
        await new Promise((r) => setTimeout(r, 60))
        return 'ok'
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.timedOut).toBe(true)
    })
  })

  describe('enrichment helpers', () => {
    it('builds line items from booking intelligence and gates on confirm cues', async () => {
      const memory = {
        ...emptyMemory(),
        locale: 'en' as const,
        requirements: {
          ...emptyRequirements(),
          destination: 'Tokyo',
          origin: 'RUH',
          startDate: '2026-08-01',
          endDate: '2026-08-08',
          travelers: 2,
          budgetAmount: 8000,
          budgetCurrency: 'SAR',
          packageScope: 'full_package' as const,
        },
        missingFields: [],
      }
      const intel = await runBookingIntelligence({ memory, userId: 'u57' })
      expect(intel.readiness.bookingReady).toBe(true)
      const items = lineItemsFromBookingIntelligence(intel)
      expect(items.length).toBeGreaterThan(0)
      expect(shouldRunBookingExecution({
        bookingReady: true,
        userText: 'confirm booking now',
      })).toBe(true)
      expect(shouldRunBookingExecution({
        bookingReady: true,
        userText: 'just looking',
      })).toBe(false)
    })
  })

  describe('transaction manager idempotency cache', () => {
    it('caches successful operations by key', async () => {
      const txn = new TransactionManager({ enabled: true, maxRetries: 0 })
      const fn = vi.fn(async () => 'value')
      const first = await txn.runWithRetry('x', fn, { idempotencyKey: 'k1' })
      const second = await txn.runWithRetry('x', fn, { idempotencyKey: 'k1' })
      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
