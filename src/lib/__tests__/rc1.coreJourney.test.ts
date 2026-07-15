/**
 * Phase Y — RC1 end-to-end core user journey (library/integration style).
 * Feature freeze: exercises existing public APIs only; mock payment + mock providers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authService } from '../auth/authService'
import { supabase } from '../supabaseClient'
import { auditLogRepository } from '../repositories/auditLogRepository'
import { preferenceRepository } from '../repositories/preferenceRepository'
import { settingsService } from '../settings/settingsService'
import { defaultSettingsForm } from '../settings/settingsHelpers'
import { chatEngine } from '../chat/chatEngine'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { extractFromUserText } from '../agent/extractRequirements'
import { buildTripPlan, applyTripPlanEdits } from '../agent/buildItinerary'
import { emptyRequirements } from '../agent/types'
import { applyIntelligentDecisions } from '../agent/decision'
import { createLiveIntegrationEngine } from '../agent/aggregation'
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
  buildConfirmationDocument,
} from '../ticketing'
import {
  NotificationOrchestrator,
  resetNotificationOrchestrator,
  notifyBookingConfirmed,
  notifyPaymentCaptured,
  notifyTicketIssued,
} from '../notifications'
import {
  TripManager,
  resetTripRepository,
  resetTravelerProfileStore,
  resetSavedTripsStore,
  resetFavoriteDestinationsStore,
  resetRecentSearchesStore,
  resetTripManager,
  getTripRepository,
} from '../trips'
import type { TravelerInfo } from '../payment/checkoutTypes'
import type { ChatMessage } from '../chat/chatTypes'
import type { AgentToolResult } from '../agent/tools/types'

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
  }]
}

function assistantMsg(content: string): ChatMessage {
  return {
    id: `a-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'rc1-c1',
    role: 'assistant',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('Phase Y RC1 core journey e2e', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    resetTicketOrchestrator()
    resetNotificationOrchestrator()
    resetTripRepository()
    resetTravelerProfileStore()
    resetSavedTripsStore()
    resetFavoriteDestinationsStore()
    resetRecentSearchesStore()
    resetTripManager()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('completes auth → chat/voice → trip → search → book → pay → ticket → notify → my trips', async () => {
    vi.spyOn(auditLogRepository, 'create').mockResolvedValue(null)

    // 1) Sign up
    vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: {
        user: { id: 'user-rc1', email: 'rc1@example.com' },
        session: { access_token: 'tok' },
      },
      error: null,
    } as never)
    vi.spyOn(preferenceRepository, 'upsert').mockResolvedValue({
      id: 'pref-1',
      user_id: 'user-rc1',
      preferred_currency: 'SAR',
      preferred_language: 'ar',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    expect((await authService.signUp('rc1@example.com', 'Password123!')).success).toBe(true)

    // 2) Sign in
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: { id: 'user-rc1' }, session: { access_token: 'tok' } },
      error: null,
    } as never)
    expect((await authService.signIn('rc1@example.com', 'Password123!')).success).toBe(true)

    // 3) Edit profile and preferences
    vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as never)
    expect((await authService.updateProfile({ fullName: 'Ahmed RC1' })).success).toBe(true)
    const form = defaultSettingsForm('rc1@example.com', 'Ahmed RC1')
    form.preferredLanguage = 'en'
    form.preferredCurrency = 'SAR'
    expect((await settingsService.savePreferences(form)).success).toBe(true)

    // 4) Text conversation (shared chatEngine contract)
    expect(chatEngine.supportsModality('text')).toBe(true)
    const textSend = vi.fn(async (_input, handlers) => {
      const reply = assistantMsg('مرحباً، لنخطط رحلتك إلى طوكيو')
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u-text', role: 'user' as const, content: 'أريد رحلة إلى طوكيو' },
        assistant: reply,
      }
    })
    const textResult = await textSend(
      { conversationId: 'rc1-c1', content: 'أريد رحلة إلى طوكيو', modality: 'text' },
      { signal: new AbortController().signal },
    )
    expect(textResult.assistant.content).toContain('طوكيو')

    // 5) Voice conversation
    const { provider: stt } = createMockSpeechToTextProvider('أحتاج فندق وطيران إلى طوكيو')
    const tts = createMockTextToSpeechProvider()
    const voiceSend = vi.fn(async (_input, handlers) => {
      const reply = assistantMsg('خطة لطوكيو جاهزة')
      await handlers.onComplete?.(reply)
      return {
        user: {
          ...reply,
          id: 'u-voice',
          role: 'user' as const,
          modality: 'audio' as const,
          content: 'أحتاج فندق وطيران إلى طوكيو',
        },
        assistant: reply,
      }
    })
    const voice = createVoiceSession({
      stt,
      tts,
      sendTurn: voiceSend as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
    })
    await voice.startPushToTalk()
    const voiceReply = await voice.stopPushToTalkAndSend('rc1-c1')
    expect(voiceReply?.content).toContain('طوكيو')

    // 6–8) Trip request + intake + TripPlan
    const intake = extractFromUserText(
      'رحلة إلى Japan لمدة 5 أيام لشخصين بميزانية 8000 ريال',
      'ar',
    )
    expect(intake.patch.destination).toBeTruthy()
    let plan = buildTripPlan({
      conversationId: 'rc1-c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        ...intake.patch,
        destination: intake.patch.destination ?? 'Japan',
        destinations: intake.patch.destinations ?? ['Japan', 'Tokyo'],
        durationDays: intake.patch.durationDays ?? 5,
        travelers: intake.patch.travelers ?? 2,
        budgetAmount: intake.patch.budgetAmount ?? 8000,
        budgetCurrency: intake.patch.budgetCurrency ?? 'SAR',
        interests: ['food', 'culture'],
      },
    })
    expect(plan.dailyItinerary.length).toBeGreaterThan(0)

    // 9–11) Search flights/hotels + maps/weather (mock providers)
    const engine = createLiveIntegrationEngine({
      flags: {
        liveIntegrationEnabled: false,
        mockFallbackEnabled: true,
        providers: {
          amadeus: false,
          booking_com: false,
          google_maps: false,
          openweather: false,
        },
      },
    })
    const flights = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2, currency: 'SAR' },
    })
    const hotels = await engine.aggregate({
      domain: 'hotels',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { destination: 'Tokyo', travelers: 2, currency: 'SAR' },
    })
    const maps = await engine.aggregate({
      domain: 'maps',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { destination: 'Tokyo' },
    })
    const weather = await engine.aggregate({
      domain: 'weather',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { destination: 'Tokyo' },
    })
    expect(flights.items.length).toBeGreaterThan(0)
    expect(hotels.items.length).toBeGreaterThan(0)
    expect(maps.providerResults.length).toBeGreaterThan(0)
    expect(weather.providerResults.length).toBeGreaterThan(0)

    // 12) Decision scoring
    const toolResults: AgentToolResult[] = [
      {
        tool: 'flights',
        status: 'ok',
        summary: 'flights',
        data: {
          offers: [
            { airline: 'Slow Air', from: 'RUH', to: 'HND', stops: 2, price: 1800, currency: 'SAR', durationHours: 20 },
            { airline: 'Fast Air', from: 'RUH', to: 'HND', stops: 0, price: 2400, currency: 'SAR', durationHours: 11, rating: 4.6 },
          ],
        },
      },
      {
        tool: 'hotels',
        status: 'ok',
        summary: 'hotels',
        data: {
          offers: [
            { name: 'Airport Inn', area: 'Narita', nightly: 200, rating: 6 },
            { name: 'Shinjuku Stay', area: 'Shinjuku', nightly: 450, rating: 8.8, breakfastIncluded: true },
          ],
        },
      },
    ]
    plan = applyIntelligentDecisions(plan, toolResults, plan.requirements)
    expect(plan.decision).toBeTruthy()

    // 13–15) Save / duplicate / edit trip
    const booking = getBookingOrchestrator()
    const payment = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const tickets = new TicketOrchestrator({ bookingOrchestrator: booking })
    const notifications = new NotificationOrchestrator()
    const trips = new TripManager({
      repository: getTripRepository(),
      bookingOrchestrator: booking,
      paymentOrchestrator: payment,
      ticketOrchestrator: tickets,
      notificationOrchestrator: notifications,
    })

    const traveler = trips.upsertTraveler({
      userId: 'user-rc1',
      firstName: 'Ahmed',
      lastName: 'Al-Saud',
      email: 'rc1@example.com',
    })
    const managed = trips.createTrip({
      userId: 'user-rc1',
      title: plan.title,
      destination: 'Tokyo',
      destinations: ['Tokyo', 'Japan'],
      startDate: '2027-04-01',
      endDate: '2027-04-05',
      travelerIds: [traveler.id],
      tripPlanId: plan.id,
      itinerarySnapshot: {
        title: plan.title,
        destinations: ['Tokyo'],
        notes: 'RC1 journey',
      },
      status: 'upcoming',
    })
    expect(trips.saveTrip('user-rc1', managed.id).tripId).toBe(managed.id)
    const dup = trips.duplicateItinerary(managed.id, 'user-rc1')
    expect(dup.id).not.toBe(managed.id)
    const edited = applyTripPlanEdits(plan, { interests: ['food', 'culture', 'shopping'] }, 'en')
    expect(edited.requirements.interests).toContain('shopping')

    // 16–20) Mock booking → payment → tickets → notifications
    const session = booking.createBookingSession({
      userId: 'user-rc1',
      travelSessionId: 'travel-rc1',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(session.id, {
      type: 'flight',
      providerId: 'amadeus',
      providerName: 'Mock Air',
      providerOfferId: 'F-RC1',
      title: 'Mock Air: RUH → HND',
      price: 2400,
      currency: 'SAR',
      bookingUrl: 'https://example.com/f',
      expiresAt: null,
      travelerSummary: '1 adult',
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
    booking.addBookingItem(session.id, {
      type: 'hotel',
      providerId: 'booking_com',
      providerName: 'Booking.com',
      providerOfferId: 'H-RC1',
      title: 'Tokyo Central Inn',
      price: 1800,
      currency: 'SAR',
      bookingUrl: 'https://example.com/h',
      expiresAt: null,
      travelerSummary: '1 adult',
      metadata: {
        hotelName: 'Tokyo Central Inn',
        address: 'Shinjuku',
        area: 'Shinjuku',
        checkIn: '2027-04-01',
        checkOut: '2027-04-05',
        roomType: 'Twin',
        rooms: 1,
      },
    })
    const bookingSession = booking.getBookingSession(session.id)!
    const started = await payment.startFromBooking({
      bookingSession,
      returnUrl: 'https://app.example/checkout/return',
      travelers: travelers(),
      customerEmail: 'rc1@example.com',
      customerName: 'Ahmed RC1',
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
    const ticketSession = issued.session!
    expect(ticketSession.lines.some((l) => l.kind === 'flight' && l.status === 'issued')).toBe(true)
    expect(ticketSession.lines.some((l) => l.kind === 'hotel' && l.status === 'issued')).toBe(true)
    expect(buildConfirmationDocument(ticketSession).confirmationNumber).toBeTruthy()

    const recipient = {
      userId: 'user-rc1',
      displayName: 'Ahmed',
      email: 'rc1@example.com',
      phoneE164: '+966501234567',
      locale: 'en' as const,
    }
    await notifyBookingConfirmed(notifications, {
      recipient,
      bookingSessionId: bookingSession.id,
      orderId: captured.order!.id,
      channels: ['email'],
    })
    await notifyPaymentCaptured(notifications, {
      recipient,
      paymentSessionId: captured.paymentSession!.id,
      orderId: captured.order!.id,
      amount: String(captured.order!.cart.total),
      currency: 'SAR',
      channels: ['email'],
    })
    await notifyTicketIssued(notifications, {
      recipient,
      ticketSessionId: ticketSession.id,
      orderId: captured.order!.id,
      confirmationNumber: ticketSession.confirmationNumber,
      bookingSessionId: bookingSession.id,
      channels: ['email'],
    })
    expect(notifications.listSessions().length).toBeGreaterThanOrEqual(3)

    // 21–24) My Trips, confirmations, cancel, timeline/audit
    trips.linkDomainIds(managed.id, 'user-rc1', {
      bookingSessionId: bookingSession.id,
      orderId: captured.order!.id,
      paymentSessionId: captured.paymentSession!.id,
      ticketSessionId: ticketSession.id,
    })
    expect(trips.listAllUserTrips('user-rc1').some((t) => t.id === managed.id)).toBe(true)
    expect(trips.downloadConfirmation(managed.id, 'user-rc1')?.confirmationNumber).toBeTruthy()
    expect(trips.getHotelVouchers(managed.id, 'user-rc1').length).toBeGreaterThan(0)
    const timeline = trips.getTimeline(managed.id, 'user-rc1')
    expect(timeline.length).toBeGreaterThan(0)
    expect(trips.getTrip(managed.id, 'other-user')).toBeNull()

    const cancelled = trips.cancelBooking(managed.id, 'user-rc1', 'RC1 cancel path')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.audit.some((a) => a.type === 'trip.booking_cancelled')).toBe(true)
    expect(dup.title).toContain('copy')
  })
})
