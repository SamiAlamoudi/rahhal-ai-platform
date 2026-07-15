import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  TicketOrchestrator,
  resetTicketOrchestrator,
  canTransitionTicketSession,
  assertCanTransitionTicketSession,
  TicketSessionTransitionError,
  TICKET_SESSION_TRANSITIONS,
  assessTicketingEligibility,
  buildConfirmationDocument,
  maskEmail,
  maskPassport,
  sanitizeAuditMetadata,
  MockFlightTicketProvider,
  MockHotelVoucherProvider,
} from '../ticketing'
import {
  PaymentOrchestrator,
  createMockPaymentAdapter,
  resetPaymentOrchestrator,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
} from '../payment'
import {
  getBookingOrchestrator,
  resetBookingOrchestrator,
} from '../booking'
import type { BookingSession } from '../booking/bookingTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import type { TravelerInfo } from '../payment/checkoutTypes'

function travelers(): TravelerInfo[] {
  return [{
    id: 't1',
    firstName: 'Ahmed',
    lastName: 'Al-Saud',
    dateOfBirth: null,
    passportNumber: 'A12345678',
    passportExpiry: null,
    nationality: 'SA',
    type: 'adult',
  }, {
    id: 't2',
    firstName: 'Sara',
    lastName: 'Al-Saud',
    dateOfBirth: null,
    passportNumber: 'B98765432',
    passportExpiry: null,
    nationality: 'SA',
    type: 'adult',
  }]
}

async function paidBookingBundle(input: {
  includeFlight?: boolean
  includeHotel?: boolean
}): Promise<{
  bookingSession: BookingSession
  order: RahhalOrder
  paymentSession: PaymentSession
  payment: PaymentOrchestrator
  booking: ReturnType<typeof getBookingOrchestrator>
}> {
  const includeFlight = input.includeFlight !== false
  const includeHotel = input.includeHotel !== false
  const booking = getBookingOrchestrator()
  const session = booking.createBookingSession({
    userId: 'user-1',
    travelSessionId: 'travel-1',
    currency: 'SAR',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  })
  if (includeFlight) {
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'F1',
      title: 'Mock Air: RUH → HND',
      price: 2400,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '2 adults',
      metadata: {
        flightNumber: 'MA200',
        segments: [{
          airline: 'Mock Air',
          flightNumber: 'MA200',
          from: 'RUH',
          to: 'HND',
          departureAt: '2027-04-01T10:00:00.000Z',
          arrivalAt: '2027-04-01T23:00:00.000Z',
          cabin: 'economy',
          baggage: '1 x 23kg',
        }],
      },
    })
  }
  if (includeHotel) {
    booking.addBookingItem(session.id, {
      type: 'hotel',
      providerId: 'booking_com',
      providerName: 'Booking.com',
      providerOfferId: 'H1',
      title: 'Tokyo Central Inn',
      price: 1800,
      currency: 'SAR',
      bookingUrl: 'https://example.com/h',
      expiresAt: null,
      travelerSummary: '2 adults',
      metadata: {
        hotelName: 'Tokyo Central Inn',
        address: '1-1 Shinjuku, Tokyo',
        area: 'Shinjuku',
        checkIn: '2027-04-01',
        checkOut: '2027-04-05',
        roomType: 'Deluxe Twin',
        rooms: 2,
      },
    })
  }

  const bookingSession = booking.getBookingSession(session.id)!
  const payment = new PaymentOrchestrator({
    adapter: createMockPaymentAdapter(),
    persist: false,
  })
  const started = await payment.startFromBooking({
    bookingSession,
    returnUrl: 'https://app.example/checkout/return',
    travelers: travelers(),
    customerEmail: 'ahmed@example.com',
    customerName: 'Ahmed Al-Saud',
  })
  expect(started.success).toBe(true)
  const captured = await payment.captureTokenizedPayment(
    started.checkoutSession!.order.id,
    started.checkoutSession!.lockToken!,
  )
  expect(captured.success).toBe(true)
  expect(captured.paymentSession?.status).toBe('paid')

  return {
    bookingSession,
    order: captured.order!,
    paymentSession: captured.paymentSession!,
    payment,
    booking,
  }
}

describe('Phase T TicketSession state machine', () => {
  it('allows Created → Pending → Issuing → Issued → Delivered', () => {
    expect(canTransitionTicketSession('created', 'pending')).toBe(true)
    expect(canTransitionTicketSession('pending', 'issuing')).toBe(true)
    expect(canTransitionTicketSession('issuing', 'issued')).toBe(true)
    expect(canTransitionTicketSession('issued', 'delivered')).toBe(true)
    expect(TICKET_SESSION_TRANSITIONS.delivered).toEqual(
      expect.arrayContaining(['voided', 'reissue_required']),
    )
  })

  it('rejects invalid state transitions', () => {
    expect(canTransitionTicketSession('delivered', 'pending')).toBe(false)
    expect(canTransitionTicketSession('expired', 'pending')).toBe(false)
    expect(() => assertCanTransitionTicketSession('delivered', 'issuing')).toThrow(
      TicketSessionTransitionError,
    )
  })
})

describe('Phase T privacy / audit masking', () => {
  it('masks email and passport; redacts sensitive audit keys', () => {
    expect(maskEmail('ahmed@example.com')).toBe('a***@example.com')
    expect(maskPassport('A12345678')).toMatch(/\*{4}5678/)
    expect(sanitizeAuditMetadata({
      passportNumber: 'A12345678',
      card: '4111',
      providerId: 'mock_flight_ticket',
      email: 'sara@example.com',
    })).toMatchObject({
      passportNumber: '[redacted]',
      card: '[redacted]',
      providerId: 'mock_flight_ticket',
      email: 's***@example.com',
    })
  })
})

describe('Phase T TicketOrchestrator', () => {
  let tickets: TicketOrchestrator

  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    resetTicketOrchestrator()
    tickets = new TicketOrchestrator({
      flightProvider: new MockFlightTicketProvider(),
      hotelProvider: new MockHotelVoucherProvider(),
      bookingOrchestrator: getBookingOrchestrator(),
    })
  })

  afterEach(() => {
    resetTicketOrchestrator()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
  })

  it('blocks ticketing before payment is captured', async () => {
    const booking = getBookingOrchestrator()
    const session = booking.createBookingSession({
      userId: 'u',
      travelSessionId: null,
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Air',
      providerOfferId: 'F',
      title: 'RUH → JED',
      price: 400,
      currency: 'SAR',
      bookingUrl: 'https://example.com',
      expiresAt: null,
      travelerSummary: '',
      metadata: {},
    })
    const eligibility = assessTicketingEligibility({
      bookingSession: booking.getBookingSession(session.id)!,
      order: {
        id: 'ord',
        orderNumber: 'O1',
        bookingNumber: 'B1',
        customerReference: 'C1',
        userId: 'u',
        travelSessionId: null,
        status: 'pending_payment',
        cart: {
          items: [],
          subtotal: 400,
          taxes: 0,
          fees: 0,
          discount: 0,
          total: 400,
          currency: 'SAR',
        },
        travelers: [],
        couponCode: null,
        discountAmount: 0,
        paymentSessionId: null,
        paymentProvider: null,
        paidAt: null,
        confirmedAt: null,
        invoiceNumber: null,
        itineraryId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      paymentSession: null,
    })
    expect(eligibility.eligible).toBe(false)
  })

  it('issues full flight + hotel tickets and builds confirmation documents', async () => {
    const bundle = await paidBookingBundle({})
    const result = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })

    expect(result.success).toBe(true)
    expect(result.complete).toBe(true)
    expect(result.partial).toBe(false)
    expect(result.session?.status).toBe('delivered')
    expect(result.session?.lines.every((l) => l.status === 'issued')).toBe(true)
    expect(result.session?.lines.find((l) => l.kind === 'flight')?.airlinePnr).toMatch(/^PNR/)
    expect(result.session?.lines.find((l) => l.kind === 'hotel')?.hotelConfirmationNumber).toMatch(/^HTL/)
    expect(result.session?.documents.length).toBe(1)

    const doc = result.session!.documents[0]
    expect(doc.travelers.length).toBe(2)
    expect(doc.flightSegments[0]?.flightNumber).toBe('MA200')
    expect(doc.flightSegments[0]?.baggage).toBe('1 x 23kg')
    expect(doc.hotelName).toBe('Tokyo Central Inn')
    expect(doc.checkIn).toBe('2027-04-01')
    expect(doc.roomDetails.length).toBe(2)
    expect(doc.paymentSummary.customerEmailMasked).toBe('a***@example.com')
    expect(doc.qrCodeData.format).toBe('rahhal-ticket-v1')
    expect(doc.supportContact).toMatch(/support@rahhal.example/)
    expect(result.session!.audit.length).toBeGreaterThan(3)
    expect(JSON.stringify(result.session!.audit)).not.toMatch(/A12345678|ahmed@example.com/)
  })

  it('supports flight-only issuance', async () => {
    const bundle = await paidBookingBundle({ includeHotel: false })
    const result = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    expect(result.complete).toBe(true)
    expect(result.session?.lines).toHaveLength(1)
    expect(result.session?.lines[0]?.kind).toBe('flight')
    expect(result.session?.lines[0]?.airlinePnr).toBeTruthy()
  })

  it('supports hotel-only issuance', async () => {
    const bundle = await paidBookingBundle({ includeFlight: false })
    const result = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    expect(result.complete).toBe(true)
    expect(result.session?.lines).toHaveLength(1)
    expect(result.session?.lines[0]?.kind).toBe('hotel')
    expect(result.session?.lines[0]?.hotelConfirmationNumber).toBeTruthy()
  })

  it('handles partial failure without marking full confirmation', async () => {
    const bundle = await paidBookingBundle({})
    const hotelItemId = bundle.bookingSession.items.find((i) => i.type === 'hotel')!.id
    const result = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
      forceFailByBookingItemId: { [hotelItemId]: true },
    })

    expect(result.partial).toBe(true)
    expect(result.complete).toBe(false)
    expect(result.session?.status).toBe('failed')
    expect(result.session?.documents).toHaveLength(0)
    expect(result.session?.confirmationNumber).toBeNull()
    expect(result.session?.lines.find((l) => l.kind === 'flight')?.status).toBe('issued')
    expect(result.session?.lines.find((l) => l.kind === 'hotel')?.status).toBe('failed')
    expect(result.session?.audit.some((a) => a.type === 'partial_issuance')).toBe(true)
  })

  it('retries failed lines safely and can complete afterward', async () => {
    const bundle = await paidBookingBundle({})
    const flightItemId = bundle.bookingSession.items.find((i) => i.type === 'flight')!.id
    const first = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
      forceFailByBookingItemId: { [flightItemId]: true },
    })
    expect(first.partial).toBe(true)

    const retried = await tickets.retryFailed(first.session!.id)
    expect(retried.complete).toBe(true)
    expect(retried.session?.status).toBe('delivered')
    expect(retried.session?.lines.every((l) => l.status === 'issued')).toBe(true)
    expect(retried.session?.lines.find((l) => l.kind === 'flight')?.attemptCount).toBeGreaterThan(1)
  })

  it('prevents duplicate ticket issuance for the same booking/order', async () => {
    const bundle = await paidBookingBundle({})
    const first = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    expect(first.complete).toBe(true)

    const second = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    expect(second.success).toBe(false)
    expect(second.message).toMatch(/Duplicate/i)
    expect(second.session?.id).toBe(first.session?.id)
  })

  it('supports expiration', async () => {
    const bundle = await paidBookingBundle({ includeHotel: false })
    const started = tickets.startTicketing({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    const expired = tickets.expire(started.session!.id)
    expect(expired.session?.status).toBe('expired')
    expect(expired.session?.lines.every((l) => l.status === 'expired' || l.status === 'pending')).toBe(true)
  })

  it('supports cancellation before issuance completes', async () => {
    const bundle = await paidBookingBundle({})
    const started = tickets.startTicketing({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    const cancelled = tickets.cancel(started.session!.id)
    expect(cancelled.success).toBe(true)
    expect(cancelled.session?.status).toBe('cancelled')
    expect(cancelled.session?.lines.every((l) => l.status === 'cancelled')).toBe(true)
  })

  it('supports voiding after issuance', async () => {
    const bundle = await paidBookingBundle({})
    const issued = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    const voided = await tickets.voidSession(issued.session!.id)
    expect(voided.success).toBe(true)
    expect(voided.session?.status).toBe('voided')
    expect(voided.session?.lines.every((l) => l.status === 'voided')).toBe(true)
  })

  it('integrates booking ↔ payment ↔ ticketing end-to-end with audit timeline', async () => {
    const bundle = await paidBookingBundle({})
    const result = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    expect(result.session?.paymentSummary.status).toBe('paid')
    expect(result.session?.bookingSessionId).toBe(bundle.bookingSession.id)
    expect(result.session?.orderId).toBe(bundle.order.id)

    const bookingAfter = bundle.booking.getBookingSession(bundle.bookingSession.id)
    expect(bookingAfter?.providerReferences.length).toBeGreaterThan(0)
    // Failed issuance must not confirm — here full success may move booking to pending_provider_confirmation, never silent invent confirmed
    expect(bookingAfter?.status).not.toBe('confirmed')

    const timelineTypes = result.session!.audit.map((a) => a.type)
    expect(timelineTypes).toEqual(expect.arrayContaining([
      'session_queue',
      'session_start_issuing',
      'line_issued',
      'document_built',
      'session_deliver',
    ]))

    const rebuilt = buildConfirmationDocument(result.session!)
    expect(rebuilt.bookingReferences.length).toBeGreaterThan(0)
    expect(rebuilt.airlinePnrs.length).toBe(1)
    expect(rebuilt.hotelConfirmationNumbers.length).toBe(1)
  })

  it('marks reissue_required for future workflows', async () => {
    const bundle = await paidBookingBundle({ includeHotel: false })
    const issued = await tickets.startAndIssue({
      bookingSession: bundle.bookingSession,
      order: bundle.order,
      paymentSession: bundle.paymentSession,
    })
    const reissue = tickets.markReissueRequired(issued.session!.id)
    expect(reissue.session?.status).toBe('reissue_required')
  })
})
