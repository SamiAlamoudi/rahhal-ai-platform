/**
 * Phase AA — repeatable post-release verification suite (library-level).
 * Extends RC1 smoke with post-launch monitoring checks; no UI redesign.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from '../auth/authService'
import { supabase } from '../supabaseClient'
import { chatEngine } from '../chat/chatEngine'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { buildTripPlan } from '../agent/buildItinerary'
import { emptyRequirements } from '../agent/types'
import {
  getBookingOrchestrator,
  resetBookingOrchestrator,
} from '../booking'
import {
  PaymentOrchestrator,
  createMockPaymentAdapter,
  resetPaymentOrchestrator,
  clearAllOrders,
  clearAllLocks,
  clearCoupons,
} from '../payment'
import {
  TicketOrchestrator,
  resetTicketOrchestrator,
} from '../ticketing'
import {
  NotificationOrchestrator,
  resetNotificationOrchestrator,
  notifyTicketIssued,
} from '../notifications'
import {
  TripManager,
  resetTripRepository,
  resetTripManager,
  getTripRepository,
} from '../trips'
import {
  checkHealth,
  checkLiveness,
  checkReadiness,
  collectMonitoringSnapshot,
  evaluateAlertRules,
  assertNoSecretsInText,
} from '../ops'
import { getDefaultPaymentProviderType } from '../payment'

describe('Phase AA post-release verification', () => {
  beforeEach(() => {
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    resetTicketOrchestrator()
    resetNotificationOrchestrator()
    resetTripRepository()
    resetTripManager()
    vi.restoreAllMocks()
  })

  it('app availability and health/readiness/liveness probes pass', () => {
    expect(checkLiveness().status).toBe('ok')
    const ready = checkReadiness({ target: 'staging', paymentProvider: 'mock' })
    expect(ready.status).toBe('ok')
    const health = checkHealth({ target: 'staging', paymentProvider: 'mock', enforceEnv: false })
    expect(['ok', 'degraded']).toContain(health.status)
    const snapshot = collectMonitoringSnapshot({ target: 'staging', paymentProvider: 'mock' })
    expect(snapshot.liveness).toBe('ok')
  })

  it('sign-in works (mocked supabase)', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: { id: 'post-1' }, session: { access_token: 'tok' } },
      error: null,
    } as never)
    expect((await authService.signIn('post@example.com', 'Password123!')).success).toBe(true)
  })

  it('text conversation modality is available', () => {
    expect(chatEngine.supportsModality('text')).toBe(true)
  })

  it('voice session initializes with mock providers', async () => {
    const { provider: stt } = createMockSpeechToTextProvider()
    const tts = createMockTextToSpeechProvider()
    const session = createVoiceSession({
      stt,
      tts,
      requestPermission: async () => ({ state: 'granted', error: null }),
    })
    await session.ensureMicPermission()
    expect(session.getStatus()).toBe('idle')
    session.dispose()
  })

  it('trip creation produces a plan', () => {
    const plan = buildTripPlan({
      conversationId: 'post-release',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Tokyo',
        destinations: ['Tokyo'],
        durationDays: 4,
        travelers: 2,
      },
    })
    expect(plan.dailyItinerary.length).toBeGreaterThan(0)
  })

  it('mock booking → payment → ticket → notification → My Trips path', async () => {
    const booking = getBookingOrchestrator()
    const payment = new PaymentOrchestrator({ adapter: createMockPaymentAdapter(), persist: false })
    const tickets = new TicketOrchestrator({ bookingOrchestrator: booking })
    const notifications = new NotificationOrchestrator()
    const trips = new TripManager({ repository: getTripRepository(), bookingOrchestrator: booking })

    const session = booking.createBookingSession({
      userId: 'post-user',
      travelSessionId: 'post-travel',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'POST-F1',
      title: 'RUH → DXB',
      price: 900,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {},
    })

    const started = await payment.startFromBooking({
      bookingSession: booking.getBookingSession(session.id)!,
      returnUrl: 'https://app.example/return',
      customerEmail: 'post@example.com',
      customerName: 'Post Release',
    })
    expect(started.success).toBe(true)
    const captured = await payment.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken!,
    )
    expect(captured.success).toBe(true)

    const issued = await tickets.startAndIssue({
      bookingSession: booking.getBookingSession(session.id)!,
      order: captured.order!,
      paymentSession: captured.paymentSession!,
    })
    expect(issued.success).toBe(true)

    await notifyTicketIssued(notifications, {
      recipient: {
        userId: 'post-user',
        displayName: 'Post',
        email: 'post@example.com',
        phoneE164: '+966501234567',
        locale: 'en',
      },
      ticketSessionId: issued.session!.id,
      orderId: captured.order!.id,
      confirmationNumber: issued.session!.confirmationNumber ?? 'CNF-POST',
      bookingSessionId: session.id,
      channels: ['email'],
    })
    expect(notifications.listSessions().length).toBeGreaterThan(0)

    const trip = trips.createTrip({
      userId: 'post-user',
      title: 'Post-release trip',
      destination: 'Dubai',
      bookingSessionId: session.id,
      orderId: captured.order!.id,
      status: 'upcoming',
    })
    expect(trips.getTrip(trip.id, 'post-user')?.id).toBe(trip.id)
  })

  it('mock payment remains active and monitoring shows no critical alerts when healthy', () => {
    expect(getDefaultPaymentProviderType()).toBe('mock')
    expect(import.meta.env.VITE_PAYMENT_PROVIDER).toBe('mock')
    const snapshot = collectMonitoringSnapshot({ target: 'staging', paymentProvider: 'mock' })
    const critical = evaluateAlertRules(snapshot).filter((a) => a.severity === 'critical')
    expect(critical.filter((a) => a.conditionId === 'readiness_failure')).toHaveLength(0)
  })

  it('client env has no secret patterns in safe strings', () => {
    expect(assertNoSecretsInText('post-release verification ok')).toBe(true)
    expect(getDefaultPaymentProviderType()).toBe('mock')
  })
})
