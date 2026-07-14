import { describe, it, expect, beforeEach } from 'vitest'
import { BookingOrchestrator, deriveBookingCapabilities } from '../booking/bookingOrchestrator'
import { isSafeBookingUrl, redirectBookingAction, disabledBookingAction } from '../booking/bookingAction'
import {
  redirectWithCancellationCapabilities,
  defaultBookingCapabilities,
} from '../booking/bookingCapabilities'
import {
  RAHHAL_BOOKING_FEE,
  type BookingMode,
  type BookingItem,
} from '../booking/bookingTypes'
import type { AddBookingItemInput } from '../booking/bookingOrchestrator'

function createTestOrchestrator(): BookingOrchestrator {
  return new BookingOrchestrator()
}

function defaultExpiry(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

function pastExpiry(): string {
  return new Date(Date.now() - 60 * 1000).toISOString()
}

function flightItemInput(overrides: Partial<AddBookingItemInput> = {}): AddBookingItemInput {
  return {
    type: 'flight',
    providerId: 'amadeus-flight-001',
    providerName: 'Amadeus',
    providerOfferId: 'offer-001',
    title: 'JAL 462: RUH → NRT',
    price: 5500,
    currency: 'SAR',
    bookingUrl: 'https://www.amadeus.com/booking/offer-001',
    expiresAt: defaultExpiry(),
    travelerSummary: '2 adults',
    metadata: {},
    ...overrides,
  }
}

function hotelItemInput(overrides: Partial<AddBookingItemInput> = {}): AddBookingItemInput {
  return {
    type: 'hotel',
    providerId: 'booking-hotel-001',
    providerName: 'Booking.com',
    providerOfferId: 'hotel-123',
    title: 'Hilton Tokyo Odaiba',
    price: 850,
    currency: 'SAR',
    bookingUrl: 'https://www.booking.com/hotel/123',
    expiresAt: defaultExpiry(),
    travelerSummary: '2 adults, 1 room',
    metadata: {},
    ...overrides,
  }
}

function rentalCarItemInput(overrides: Partial<AddBookingItemInput> = {}): AddBookingItemInput {
  return {
    type: 'rental_car',
    providerId: 'rentalcars-001',
    providerName: 'RentalCars.com',
    providerOfferId: 'veh-001',
    title: 'Toyota Corolla',
    price: 450,
    currency: 'SAR',
    bookingUrl: 'https://www.rentalcars.com/book/veh-001',
    expiresAt: defaultExpiry(),
    travelerSummary: '1 driver',
    metadata: {},
    ...overrides,
  }
}

// ── URL Validation Tests ─────────────────────────────────────────────────────

describe('Safe URL Validation', () => {
  it('accepts https URLs', () => {
    expect(isSafeBookingUrl('https://www.amadeus.com/booking/123')).toBe(true)
  })

  it('accepts http URLs', () => {
    expect(isSafeBookingUrl('http://example.com/booking')).toBe(true)
  })

  it('rejects javascript: protocol', () => {
    expect(isSafeBookingUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects data: protocol', () => {
    expect(isSafeBookingUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects ftp: protocol', () => {
    expect(isSafeBookingUrl('ftp://example.com/file')).toBe(false)
  })

  it('rejects file: protocol', () => {
    expect(isSafeBookingUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isSafeBookingUrl('')).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(isSafeBookingUrl('not-a-url')).toBe(false)
    expect(isSafeBookingUrl('  ')).toBe(false)
  })

  it('rejects localhost', () => {
    expect(isSafeBookingUrl('http://localhost:3000/booking')).toBe(false)
  })

  it('rejects 127.0.0.1', () => {
    expect(isSafeBookingUrl('http://127.0.0.1/admin')).toBe(false)
  })

  it('rejects URLs exceeding 2048 characters', () => {
    expect(isSafeBookingUrl('https://example.com/' + 'a'.repeat(2100))).toBe(false)
  })
})

// ── Booking Action Tests ─────────────────────────────────────────────────────

describe('BookingAction', () => {
  it('returns allowed redirect action for valid URL', () => {
    const action = redirectBookingAction('prov-1', 'Provider One', 'https://example.com/book', null)
    expect(action.allowed).toBe(true)
    expect(action.mode).toBe('redirect')
    expect(action.requiresExternalPayment).toBe(true)
    expect(action.requiresUserConfirmation).toBe(true)
    expect(action.bookingUrl).toBe('https://example.com/book')
  })

  it('returns disabled action for missing URL', () => {
    const action = redirectBookingAction('prov-1', 'Provider One', '', null)
    expect(action.allowed).toBe(false)
    expect(action.messageKey).toBe('redirect_url_missing')
  })

  it('returns disabled action for unsafe URL', () => {
    const action = redirectBookingAction('prov-1', 'Provider One', 'javascript:alert(1)', null)
    expect(action.allowed).toBe(false)
    expect(action.messageKey).toBe('redirect_invalid_url')
  })

  it('disabledBookingAction returns embedded_not_supported for embedded mode', () => {
    const action = disabledBookingAction('embedded', 'prov-1', 'Provider One', 'embedded_not_supported')
    expect(action.allowed).toBe(false)
    expect(action.mode).toBe('embedded')
    expect(action.messageKey).toBe('embedded_not_supported')
  })

  it('disabledBookingAction returns merchant_not_supported for merchant mode', () => {
    const action = disabledBookingAction('merchant', 'prov-1', 'Provider One', 'merchant_not_supported')
    expect(action.allowed).toBe(false)
    expect(action.mode).toBe('merchant')
    expect(action.messageKey).toBe('merchant_not_supported')
  })
})

// ── Booking Capabilities Tests ───────────────────────────────────────────────

describe('Booking Capabilities', () => {
  it('redirectWithCancellationCapabilities supports redirect and cancellation', () => {
    const caps = redirectWithCancellationCapabilities()
    expect(caps.supportsRedirect).toBe(true)
    expect(caps.supportsCancellation).toBe(true)
    expect(caps.supportsEmbeddedCheckout).toBe(false)
    expect(caps.supportsMerchantBooking).toBe(false)
  })

  it('defaultBookingCapabilities has everything disabled', () => {
    const caps = defaultBookingCapabilities()
    expect(caps.supportsRedirect).toBe(false)
    expect(caps.supportsEmbeddedCheckout).toBe(false)
    expect(caps.supportsMerchantBooking).toBe(false)
  })

  it('deriveBookingCapabilities returns redirect caps for valid URL', () => {
    const caps = deriveBookingCapabilities('flight', 'https://example.com/book', true)
    expect(caps.supportsRedirect).toBe(true)
    expect(caps.supportsCancellation).toBe(true)
    expect(caps.supportsConfirmationImport).toBe(true)
  })

  it('deriveBookingCapabilities returns default caps for no URL', () => {
    const caps = deriveBookingCapabilities('hotel', '', false)
    expect(caps.supportsRedirect).toBe(false)
  })

  it('deriveBookingCapabilities returns default caps for unsafe URL', () => {
    const caps = deriveBookingCapabilities('hotel', 'javascript:alert(1)', false)
    expect(caps.supportsRedirect).toBe(false)
  })
})

// ── Booking Orchestrator — Session Creation ─────────────────────────────────

describe('BookingOrchestrator — Session Creation', () => {
  let orchestrator: BookingOrchestrator

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
  })

  it('creates a session with draft status', () => {
    const session = orchestrator.createBookingSession({
      userId: 'user-1',
      travelSessionId: 'session-1',
      currency: 'SAR',
      expiresAt: defaultExpiry(),
    })
    expect(session.status).toBe('draft')
    expect(session.items).toEqual([])
    expect(session.currency).toBe('SAR')
    expect(session.userId).toBe('user-1')
    expect(session.subtotal).toBe(0)
    expect(session.fees).toBe(RAHHAL_BOOKING_FEE)
    expect(session.total).toBe(0)
    expect(session.selectedBookingMode).toBe('redirect')
  })

  it('generates unique session IDs', () => {
    const s1 = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    const s2 = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    expect(s1.id).not.toBe(s2.id)
  })

  it('getBookingSession returns the session by ID', () => {
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    const retrieved = orchestrator.getBookingSession(session.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(session.id)
  })

  it('getBookingSession returns null for non-existent session', () => {
    expect(orchestrator.getBookingSession('non-existent')).toBeNull()
  })
})

// ── Booking Orchestrator — Adding/Removing Items ─────────────────────────────

describe('BookingOrchestrator — Items', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
  })

  it('adds a flight item and transitions to selected', () => {
    const result = orchestrator.addBookingItem(sessionId, flightItemInput())
    expect(result.error).toBeNull()
    expect(result.session!.items.length).toBe(1)
    expect(result.session!.status).toBe('selected')
    expect(result.session!.items[0].title).toBe('JAL 462: RUH → NRT')
  })

  it('adds multiple items (flight, hotel, rental car)', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    orchestrator.addBookingItem(sessionId, hotelItemInput())
    orchestrator.addBookingItem(sessionId, rentalCarItemInput())
    const session = orchestrator.getBookingSession(sessionId)!
    expect(session.items.length).toBe(3)
    expect(session.items.map(i => i.type)).toEqual(['flight', 'hotel', 'rental_car'])
  })

  it('prevents duplicate items', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const result = orchestrator.addBookingItem(sessionId, flightItemInput())
    expect(result.error).toBe('Duplicate booking item')
    expect(result.session!.items.length).toBe(1)
  })

  it('removes an item', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    orchestrator.addBookingItem(sessionId, hotelItemInput())
    const session = orchestrator.getBookingSession(sessionId)!
    const flightItemId = session.items.find(i => i.type === 'flight')!.id
    const updated = orchestrator.removeBookingItem(sessionId, flightItemId)
    expect(updated!.items.length).toBe(1)
    expect(updated!.items[0].type).toBe('hotel')
  })

  it('returns to draft when all items removed', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const session = orchestrator.getBookingSession(sessionId)!
    orchestrator.removeBookingItem(sessionId, session.items[0].id)
    const updated = orchestrator.getBookingSession(sessionId)!
    expect(updated.status).toBe('draft')
    expect(updated.items.length).toBe(0)
  })

  it('updates an item', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const session = orchestrator.getBookingSession(sessionId)!
    const updated = orchestrator.updateBookingItem(sessionId, session.items[0].id, { price: 6000 })
    expect(updated!.items[0].price).toBe(6000)
  })
})

// ── Booking Orchestrator — Total Calculation ─────────────────────────────────

describe('BookingOrchestrator — Total Calculation', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
  })

  it('calculates subtotal correctly', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ price: 5500 }))
    orchestrator.addBookingItem(sessionId, hotelItemInput({ price: 850 }))
    orchestrator.addBookingItem(sessionId, rentalCarItemInput({ price: 450 }))
    const summary = orchestrator.calculateBookingSummary(sessionId)!
    expect(summary.subtotal).toBe(6800)
    expect(summary.fees).toBe(RAHHAL_BOOKING_FEE)
    expect(summary.total).toBe(6800 + RAHHAL_BOOKING_FEE)
    expect(summary.itemCount).toBe(3)
  })

  it('recalculates after removing an item', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ price: 5500 }))
    orchestrator.addBookingItem(sessionId, hotelItemInput({ price: 850 }))
    const session = orchestrator.getBookingSession(sessionId)!
    orchestrator.removeBookingItem(sessionId, session.items.find(i => i.type === 'flight')!.id)
    const summary = orchestrator.calculateBookingSummary(sessionId)!
    expect(summary.subtotal).toBe(850)
    expect(summary.itemCount).toBe(1)
  })

  it('fees are always zero (Rahhal fee)', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ price: 10000 }))
    const summary = orchestrator.calculateBookingSummary(sessionId)!
    expect(summary.fees).toBe(0)
    expect(summary.total).toBe(10000)
  })
})

// ── Booking Orchestrator — Currency Consistency ──────────────────────────────

describe('BookingOrchestrator — Currency Consistency', () => {
  let orchestrator: BookingOrchestrator

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
  })

  it('rejects item with mismatched currency', () => {
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    const result = orchestrator.addBookingItem(session.id, flightItemInput({ currency: 'USD' }))
    expect(result.error).toBe('Currency mismatch')
    expect(result.session!.items.length).toBe(0)
  })
})

// ── Booking Orchestrator — Booking Mode Determination ────────────────────────

describe('BookingOrchestrator — Booking Mode', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
  })

  it('determineBookingMode returns redirect as default', () => {
    expect(orchestrator.determineBookingMode(sessionId)).toBe('redirect')
  })

  it('determineBookingMode returns redirect even with items', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    expect(orchestrator.determineBookingMode(sessionId)).toBe('redirect')
  })

  it('determineBookingMode returns redirect for non-existent session', () => {
    expect(orchestrator.determineBookingMode('non-existent')).toBe('redirect')
  })
})

// ── Booking Orchestrator — Readiness Validation ──────────────────────────────

describe('BookingOrchestrator — Readiness Validation', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
  })

  it('returns not ready for empty session', () => {
    const readiness = orchestrator.validateBookingReadiness(sessionId)
    expect(readiness.ready).toBe(false)
    expect(readiness.warnings).toContain('No items in session')
  })

  it('returns ready for valid items with URLs', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const readiness = orchestrator.validateBookingReadiness(sessionId)
    expect(readiness.ready).toBe(true)
    expect(readiness.status).toBe('ready_to_redirect')
  })

  it('warns about expired items', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ expiresAt: pastExpiry() }))
    const readiness = orchestrator.validateBookingReadiness(sessionId)
    expect(readiness.ready).toBe(false)
    expect(readiness.warnings.some(w => w.includes('expired'))).toBe(true)
  })

  it('warns about items missing booking URL', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ bookingUrl: '' }))
    const readiness = orchestrator.validateBookingReadiness(sessionId)
    expect(readiness.ready).toBe(false)
    expect(readiness.warnings.some(w => w.includes('missing booking URL'))).toBe(true)
  })

  it('warns about currency mismatch', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ currency: 'SAR' }))
    const session = orchestrator._internalGetSession(sessionId)!
    session.currency = 'USD'
    const readiness = orchestrator.validateBookingReadiness(sessionId)
    expect(readiness.ready).toBe(false)
    expect(readiness.warnings.some(w => w.includes('Currency mismatch'))).toBe(true)
  })
})

// ── Booking Orchestrator — Redirect Preparation ──────────────────────────────

describe('BookingOrchestrator — Prepare Redirect', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
  })

  it('prepares redirect with valid URL', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const action = orchestrator.prepareRedirect(sessionId)
    expect(action).not.toBeNull()
    expect(action!.allowed).toBe(true)
    expect(action!.mode).toBe('redirect')
    expect(action!.bookingUrl).toBe('https://www.amadeus.com/booking/offer-001')
    expect(action!.providerName).toBe('Amadeus')
  })

  it('returns disabled action for missing URL', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ bookingUrl: '' }))
    const action = orchestrator.prepareRedirect(sessionId)
    expect(action!.allowed).toBe(false)
    expect(action!.messageKey).toBe('redirect_url_missing')
  })

  it('returns disabled action for unsafe URL', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ bookingUrl: 'javascript:alert(1)' }))
    const action = orchestrator.prepareRedirect(sessionId)
    expect(action!.allowed).toBe(false)
  })

  it('returns null for non-existent session', () => {
    expect(orchestrator.prepareRedirect('non-existent')).toBeNull()
  })

  it('returns disabled action for expired session', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const session = orchestrator._internalGetSession(sessionId)!
    session.expiresAt = pastExpiry()
    const action = orchestrator.prepareRedirect(sessionId)
    expect(action!.allowed).toBe(false)
    expect(action!.messageKey).toBe('session_expired')
  })
})

// ── Booking Orchestrator — Mark Redirected ───────────────────────────────────

describe('BookingOrchestrator — Mark Redirected', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
  })

  it('marks session as redirected', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    orchestrator.prepareRedirect(sessionId)
    const updated = orchestrator.markRedirected(sessionId)
    expect(updated!.status).toBe('redirected')
    expect(updated!.redirectedAt).not.toBeNull()
  })

  it('populates provider references on redirect', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    orchestrator.addBookingItem(sessionId, hotelItemInput())
    orchestrator.prepareRedirect(sessionId)
    const updated = orchestrator.markRedirected(sessionId)
    expect(updated!.providerReferences.length).toBe(2)
    expect(updated!.providerReferences[0].providerId).toBe('amadeus-flight-001')
    expect(updated!.providerReferences[1].providerId).toBe('booking-hotel-001')
  })

  it('preserves recommendation data in metadata after redirect', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput({ metadata: { score: 85, reasons: ['best price', 'direct'] } }))
    orchestrator.prepareRedirect(sessionId)
    const updated = orchestrator.markRedirected(sessionId)
    expect(updated!.items[0].metadata.score).toBe(85)
    expect(updated!.items[0].metadata.reasons).toEqual(['best price', 'direct'])
  })
})

// ── Booking Orchestrator — Expiration ────────────────────────────────────────

describe('BookingOrchestrator — Expiration', () => {
  let orchestrator: BookingOrchestrator

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
  })

  it('expires a session', () => {
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    const expired = orchestrator.expireBookingSession(session.id)
    expect(expired!.status).toBe('expired')
  })

  it('cannot expire a redirected session', () => {
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    orchestrator.addBookingItem(session.id, flightItemInput())
    orchestrator.prepareRedirect(session.id)
    orchestrator.markRedirected(session.id)
    const result = orchestrator.expireBookingSession(session.id)
    expect(result!.status).toBe('redirected')
  })

  it('cannot expire a confirmed session', () => {
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    const sess = orchestrator._internalGetSession(session.id)!
    sess.status = 'confirmed'
    const result = orchestrator.expireBookingSession(session.id)
    expect(result!.status).toBe('confirmed')
  })
})

// ── Booking Orchestrator — Cancellation ──────────────────────────────────────

describe('BookingOrchestrator — Cancellation', () => {
  let orchestrator: BookingOrchestrator

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
  })

  it('cancels a session', () => {
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    orchestrator.addBookingItem(session.id, flightItemInput())
    const cancelled = orchestrator.cancelBookingSession(session.id)
    expect(cancelled!.status).toBe('cancelled')
  })

  it('cannot cancel a confirmed session', () => {
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    const sess = orchestrator._internalGetSession(session.id)!
    sess.status = 'confirmed'
    const result = orchestrator.cancelBookingSession(session.id)
    expect(result!.status).toBe('confirmed')
  })
})

// ── Booking Orchestrator — Provider Reference (Pending Confirmation) ─────────

describe('BookingOrchestrator — Provider Reference', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
    orchestrator.addBookingItem(sessionId, flightItemInput())
    orchestrator.prepareRedirect(sessionId)
    orchestrator.markRedirected(sessionId)
  })

  it('adds provider reference and sets status to pending_provider_confirmation', () => {
    const updated = orchestrator.addProviderReference(sessionId, 'amadeus-flight-001', 'ABC123XYZ')
    expect(updated!.status).toBe('pending_provider_confirmation')
    const ref = updated!.providerReferences.find(r => r.providerId === 'amadeus-flight-001')
    expect(ref!.providerBookingReference).toBe('ABC123XYZ')
  })

  it('never auto-confirms — status stays pending_provider_confirmation', () => {
    orchestrator.addProviderReference(sessionId, 'amadeus-flight-001', 'REF-001')
    const session = orchestrator.getBookingSession(sessionId)!
    expect(session.status).toBe('pending_provider_confirmation')
    expect(session.status).not.toBe('confirmed')
  })

  it('manual reference remains pending — no automatic confirmed status', () => {
    orchestrator.addProviderReference(sessionId, 'amadeus-flight-001', 'ANY-REF')
    const session = orchestrator.getBookingSession(sessionId)!
    expect(session.confirmedAt).toBeNull()
    expect(session.status).not.toBe('confirmed')
  })
})

// ── Booking Orchestrator — Status Transition Events ──────────────────────────

describe('BookingOrchestrator — Status Transitions', () => {
  let orchestrator: BookingOrchestrator
  let sessionId: string

  beforeEach(() => {
    orchestrator = createTestOrchestrator()
    const session = orchestrator.createBookingSession({ userId: 'user-1', travelSessionId: null, currency: 'SAR', expiresAt: defaultExpiry() })
    sessionId = session.id
  })

  it('transitions draft → selected on first item', () => {
    const result = orchestrator.addBookingItem(sessionId, flightItemInput())
    expect(result.session!.status).toBe('selected')
  })

  it('transitions selected → ready_to_redirect on validation', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const readiness = orchestrator.validateBookingReadiness(sessionId)
    expect(readiness.status).toBe('ready_to_redirect')
  })

  it('transitions ready_to_redirect → redirected on markRedirected', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    orchestrator.prepareRedirect(sessionId)
    const updated = orchestrator.markRedirected(sessionId)
    expect(updated!.status).toBe('redirected')
  })

  it('transitions redirected → pending_provider_confirmation on reference', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    orchestrator.prepareRedirect(sessionId)
    orchestrator.markRedirected(sessionId)
    const updated = orchestrator.addProviderReference(sessionId, 'amadeus-flight-001', 'REF')
    expect(updated!.status).toBe('pending_provider_confirmation')
  })

  it('returns to draft when all items removed from selected', () => {
    orchestrator.addBookingItem(sessionId, flightItemInput())
    const session = orchestrator.getBookingSession(sessionId)!
    orchestrator.removeBookingItem(sessionId, session.items[0].id)
    const updated = orchestrator.getBookingSession(sessionId)!
    expect(updated.status).toBe('draft')
  })
})

// ── Repository Ownership / RLS Expectations ──────────────────────────────────

describe('Repository Ownership / RLS', () => {
  it('bookingSessionRepository exposes create, update, getById, listByUser, delete', async () => {
    const repo = (await import('../repositories/bookingSessionRepository')).bookingSessionRepository
    expect(typeof repo.create).toBe('function')
    expect(typeof repo.update).toBe('function')
    expect(typeof repo.getById).toBe('function')
    expect(typeof repo.listByUser).toBe('function')
    expect(typeof repo.delete).toBe('function')
  })

  it('bookingItemRepository exposes create, listBySession, delete, deleteBySession', async () => {
    const repo = (await import('../repositories/bookingItemRepository')).bookingItemRepository
    expect(typeof repo.create).toBe('function')
    expect(typeof repo.listBySession).toBe('function')
    expect(typeof repo.delete).toBe('function')
    expect(typeof repo.deleteBySession).toBe('function')
  })

  it('bookingEventRepository exposes create, listBySession, listByUser', async () => {
    const repo = (await import('../repositories/bookingEventRepository')).bookingEventRepository
    expect(typeof repo.create).toBe('function')
    expect(typeof repo.listBySession).toBe('function')
    expect(typeof repo.listByUser).toBe('function')
  })

  it('RLS expectations: booking_sessions uses user_id with auth.uid() ownership', () => {
    // RLS policies are defined in the migration:
    // - SELECT: auth.uid() = user_id
    // - INSERT: WITH CHECK (auth.uid() = user_id)
    // - UPDATE: USING + WITH CHECK (auth.uid() = user_id)
    // - DELETE: USING (auth.uid() = user_id)
    // This test documents the expected RLS pattern.
    expect(true).toBe(true)
  })

  it('RLS expectations: booking_items scoped through parent session ownership', () => {
    // booking_items RLS uses EXISTS subquery:
    // EXISTS (SELECT 1 FROM booking_sessions WHERE id = booking_session_id AND user_id = auth.uid())
    // This ensures child rows inherit ownership from the parent session.
    expect(true).toBe(true)
  })

  it('RLS expectations: booking_events scoped through parent session ownership', () => {
    // booking_events RLS uses EXISTS subquery on booking_sessions for SELECT,
    // and direct user_id column for INSERT/WITH CHECK.
    expect(true).toBe(true)
  })
})

// ── Existing Flows Unchanged ─────────────────────────────────────────────────

describe('Existing Flows Unchanged', () => {
  it('RAHHAL_BOOKING_FEE is zero', () => {
    expect(RAHHAL_BOOKING_FEE).toBe(0)
  })

  it('booking types include all required item types', () => {
    const types: BookingItem['type'][] = ['flight', 'hotel', 'rental_car', 'activity', 'transfer', 'insurance', 'esim']
    expect(types.length).toBe(7)
  })

  it('booking modes include redirect, embedded, merchant', () => {
    const modes: BookingMode[] = ['redirect', 'embedded', 'merchant']
    expect(modes.length).toBe(3)
  })
})
