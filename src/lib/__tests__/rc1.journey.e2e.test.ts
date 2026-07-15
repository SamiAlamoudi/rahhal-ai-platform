/**
 * Phase Y RC1 — end-to-end core user journey (library-level).
 * Covers auth → preferences → chat/voice → intake → TripPlan → search →
 * enrich → score → save/duplicate → mock book/pay/ticket/notify → My Trips.
 * Keeps VITE_PAYMENT_PROVIDER=mock and live providers OFF.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateSignUpForm, validateSignInForm } from '../auth/authValidation'
import { authService } from '../auth/authService'
import { supabase } from '../supabaseClient'
import { auditLogRepository } from '../repositories/auditLogRepository'
import {
  defaultSettingsForm,
  formStateToPreferencesInput,
  validateFullName,
} from '../settings/settingsHelpers'
import { chatEngine } from '../chat/chatEngine'
import { setChatProviderForTests, resetChatProviderForTests } from '../chat/chatService'
import { createDeterministicMockChatProvider } from '../chat/mockChatProvider'
import { conversationRepository } from '../repositories/conversationRepository'
import { messageRepository } from '../repositories/messageRepository'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { applyIntelligentDecisions } from '../agent/decision'
import {
  createLiveIntegration,
  createAggregationEngine,
  createMockAmadeusAdapter,
  createMockBookingComAdapter,
  createMockGoogleMapsAdapter,
  createMockOpenWeatherAdapter,
  resolveProviderFeatureFlags,
  isLiveProviderFlagEnabled,
} from '../agent/aggregation'
import {
  TripManager,
  resetTripRepository,
  resetTravelerProfileStore,
  resetSavedTripsStore,
  resetFavoriteDestinationsStore,
  resetRecentSearchesStore,
  resetTripManager,
  buildTripTimeline,
} from '../trips'
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
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'
import type { ChatMessage } from '../chat/chatTypes'
import type { ConversationRow, MessageRow } from '../types'
import type { TravelerInfo } from '../payment/checkoutTypes'
import type { AgentToolResult } from '../agent/tools/types'

const USER_ID = 'rc1-user-1'

function userMsg(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'rc1-conv',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

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

function conversationRow(overrides: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id: 'conv-rc1',
    user_id: USER_ID,
    title: 'رحلة اليابان',
    modality_default: 'text',
    travel_session_id: null,
    last_message_preview: '',
    created_at: '2026-07-15T10:00:00.000Z',
    updated_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

function messageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    conversation_id: 'conv-rc1',
    user_id: USER_ID,
    role: 'user',
    modality: 'text',
    content: 'hello',
    audio_url: null,
    image_url: null,
    attachments: [],
    status: 'complete',
    error: null,
    provider_meta: {},
    created_at: '2026-07-15T10:00:00.000Z',
    updated_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

describe('RC1 E2E core user journey', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetTripRepository()
    resetTravelerProfileStore()
    resetSavedTripsStore()
    resetFavoriteDestinationsStore()
    resetRecentSearchesStore()
    resetTripManager()
    resetTicketOrchestrator()
    resetNotificationOrchestrator()
    resetPaymentOrchestrator()
    resetBookingOrchestrator()
    clearAllOrders()
    clearAllLocks()
    clearCoupons()
    setChatProviderForTests(createDeterministicMockChatProvider('RC1 text reply', 0))
  })

  afterEach(() => {
    resetChatProviderForTests()
    vi.restoreAllMocks()
  })

  it('completes sign-up → sign-in → profile → chat/voice → trip → book → pay → ticket → My Trips', async () => {
    // 1–2. Sign up / sign in validation + mocked auth
    expect(validateSignUpForm('rc1@example.com', 'secret1', 'secret1')).toEqual([])
    expect(validateSignInForm('rc1@example.com', 'secret1')).toEqual([])

    vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: { user: { id: USER_ID }, session: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signUp>>)
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: { id: USER_ID }, session: { access_token: 'tok' } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)
    vi.spyOn(auditLogRepository, 'create').mockResolvedValue(null)
    vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: { user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.updateUser>>)

    expect((await authService.signUp('rc1@example.com', 'secret1')).success).toBe(true)
    expect((await authService.signIn('rc1@example.com', 'secret1')).success).toBe(true)

    // 3. Edit profile and preferences
    expect(validateFullName('Ahmed Al-Saud')).toBeNull()
    expect((await authService.updateProfile({ fullName: 'Ahmed Al-Saud' })).success).toBe(true)
    const form = defaultSettingsForm('rc1@example.com', 'Ahmed Al-Saud')
    form.preferredCurrency = 'SAR'
    form.preferredLanguage = 'ar'
    form.notifyTripUpdates = true
    const prefs = formStateToPreferencesInput(form)
    expect(prefs.preferred_currency).toBe('SAR')
    expect(prefs.preferred_language).toBe('ar')

    // 4. Text conversation
    vi.spyOn(messageRepository, 'listByConversation').mockResolvedValue([])
    vi.spyOn(messageRepository, 'create')
      .mockResolvedValueOnce(messageRow({ id: 'u1', role: 'user', content: COMPLETE_JAPAN_5D }))
      .mockResolvedValueOnce(messageRow({
        id: 'a1',
        role: 'assistant',
        content: 'RC1 text reply',
      }))
    vi.spyOn(messageRepository, 'update').mockImplementation(async (_id, updates) =>
      messageRow({
        id: 'a1',
        role: 'assistant',
        content: updates.content ?? 'RC1 text reply',
        status: updates.status ?? 'complete',
      }),
    )
    vi.spyOn(conversationRepository, 'update').mockResolvedValue(conversationRow({
      last_message_preview: 'RC1 text reply',
    }))
    vi.spyOn(conversationRepository, 'touch').mockResolvedValue()

    const textResult = await chatEngine.sendMessage({
      conversationId: 'conv-rc1',
      content: COMPLETE_JAPAN_5D,
      modality: 'text',
    }, { signal: new AbortController().signal })
    expect(textResult.assistant.content).toContain('RC1')

    // 5. Voice conversation
    const { provider: stt } = createMockSpeechToTextProvider('أحتاج فندق في طوكيو')
    const tts = createMockTextToSpeechProvider()
    const voiceSend = vi.fn(async (_input, handlers) => {
      const reply = {
        ...userMsg('خطة لطوكيو'),
        id: 'a-voice',
        role: 'assistant' as const,
      }
      handlers.onDelta?.({ ...reply, content: 'خطة', status: 'streaming' as const })
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u-voice', role: 'user' as const, modality: 'audio' as const, content: 'أحتاج فندق في طوكيو' },
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
    const voiceReply = await voice.stopPushToTalkAndSend('conv-rc1')
    expect(voiceReply?.content).toMatch(/طوكيو|خطة/)
    voice.dispose()

    // 6–8. Trip request + interactive intake + TripPlan generation
    const agent = createTravelAgentService({ tools: createMockAgentToolRegistry() })
    const planned = await agent.planTurn({
      conversationId: 'rc1-conv',
      messages: [userMsg(COMPLETE_JAPAN_5D)],
    })
    expect(planned.memory.missingFields).toEqual([])
    expect(planned.tripPlan).toBeTruthy()
    expect(planned.tripPlan!.dailyItinerary.length).toBe(5)
    expect(planned.tripPlan!.flights.length).toBeGreaterThan(0)
    expect(planned.tripPlan!.accommodations.length).toBeGreaterThan(0)

    // 9–11. Search flights/hotels + maps/weather enrichment (mocks; live OFF)
    const flags = resolveProviderFeatureFlags({
      liveIntegrationEnabled: false,
      mockFallbackEnabled: true,
      providers: {
        amadeus: false,
        booking_com: false,
        google_maps: false,
        openweather: false,
      },
    })
    expect(isLiveProviderFlagEnabled(flags, 'amadeus')).toBe(false)

    const live = createLiveIntegration({ flags })
    live.registry.register(createMockAmadeusAdapter())
    live.registry.register(createMockBookingComAdapter())
    live.registry.register(createMockGoogleMapsAdapter())
    live.registry.register(createMockOpenWeatherAdapter())
    const engine = createAggregationEngine({
      registry: live.registry,
      selectionStrategy: 'priority_fallback',
      liveIntegration: {
        selectionLog: live.selectionLog,
        metrics: live.metrics,
      },
    })

    const flights = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2, currency: 'USD' },
    })
    const hotels = await engine.aggregate({
      domain: 'hotels',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { destination: 'Japan', nights: 4, currency: 'USD' },
    })
    const maps = await engine.aggregate({
      domain: 'maps',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { destination: 'Japan', hubs: ['Tokyo', 'Kyoto'] },
    })
    const weather = await engine.aggregate({
      domain: 'weather',
      locale: 'en',
      selectionStrategy: 'priority_fallback',
      input: { destination: 'Japan', startDate: '2027-04-01' },
    })
    expect(flights.items.length).toBeGreaterThan(0)
    expect(hotels.items.length).toBeGreaterThan(0)
    expect(maps.items.length).toBeGreaterThan(0)
    expect(weather.items.length).toBeGreaterThan(0)

    // 12. Decision scoring (re-apply with explicit tool offers for deterministic enrichment)
    const toolResults: AgentToolResult[] = [
      {
        tool: 'flights',
        status: 'ok',
        summary: 'flights',
        data: {
          offers: [
            { airline: 'Slow Air', from: 'RUH', to: 'HND', stops: 2, price: 480, currency: 'USD', durationHours: 20 },
            { airline: 'Fast Air', from: 'RUH', to: 'HND', stops: 0, price: 690, currency: 'USD', durationHours: 11, rating: 4.6 },
          ],
        },
      },
      {
        tool: 'hotels',
        status: 'ok',
        summary: 'hotels',
        data: {
          stays: [
            { name: 'Far Hotel', area: 'Chiba', category: 'hotel', nightly: 80, currency: 'USD', rating: 6 },
            { name: 'Tokyo Central', area: 'Tokyo', category: 'hotel', nightly: 160, currency: 'USD', rating: 9 },
          ],
        },
      },
    ]
    const decided = applyIntelligentDecisions(
      planned.tripPlan!,
      toolResults,
      planned.tripPlan!.requirements,
    )
    expect(decided.decision).toBeTruthy()
    expect(decided.decision!.scores.overall).toBeGreaterThan(0)

    // 13–16. Save trip request context → mock booking → mock payment
    expect(import.meta.env.VITE_PAYMENT_PROVIDER).toBe('mock')
    const booking = getBookingOrchestrator()
    const bookingSession = booking.createBookingSession({
      userId: USER_ID,
      travelSessionId: 'travel-rc1',
      currency: 'SAR',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
    booking.addBookingItem(bookingSession.id, {
      type: 'flight',
      providerId: 'amadeus_mock',
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
    booking.addBookingItem(bookingSession.id, {
      type: 'hotel',
      providerId: 'booking_com_mock',
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
        address: '1-1 Shinjuku, Tokyo',
        area: 'Shinjuku',
        checkIn: '2027-04-01',
        checkOut: '2027-04-05',
        roomType: 'Deluxe Twin',
        rooms: 1,
      },
    })

    const payment = new PaymentOrchestrator({
      adapter: createMockPaymentAdapter(),
      persist: false,
    })
    const started = await payment.startFromBooking({
      bookingSession: booking.getBookingSession(bookingSession.id)!,
      returnUrl: 'https://app.example/checkout/return',
      travelers: travelers(),
      customerEmail: 'rc1@example.com',
      customerName: 'Ahmed Al-Saud',
    })
    expect(started.success).toBe(true)
    const captured = await payment.captureTokenizedPayment(
      started.checkoutSession!.order.id,
      started.checkoutSession!.lockToken!,
    )
    expect(captured.success).toBe(true)
    expect(captured.paymentSession?.status).toBe('paid')

    // 17–18. Mock flight ticket + hotel voucher
    const tickets = new TicketOrchestrator({ bookingOrchestrator: booking })
    const issued = await tickets.startAndIssue({
      bookingSession: booking.getBookingSession(bookingSession.id)!,
      order: captured.order!,
      paymentSession: captured.paymentSession!,
    })
    expect(issued.success).toBe(true)
    expect(issued.partial).toBe(false)
    const ticketSession = issued.session!
    expect(ticketSession.lines.some((l) => l.kind === 'flight' && l.status === 'issued')).toBe(true)
    expect(ticketSession.lines.some((l) => l.kind === 'hotel' && l.status === 'issued')).toBe(true)

    // 19. Mock notifications
    const notifications = new NotificationOrchestrator()
    const recipient = {
      userId: USER_ID,
      displayName: 'Ahmed',
      email: 'rc1@example.com',
      phoneE164: '+966501234567',
      locale: 'en' as const,
    }
    await notifyBookingConfirmed(notifications, {
      recipient,
      bookingSessionId: bookingSession.id,
      orderId: captured.order!.id,
      bookingReference: ticketSession.bookingReference,
      orderNumber: captured.order!.orderNumber,
      channels: ['email'],
    })
    await notifyPaymentCaptured(notifications, {
      recipient,
      paymentSessionId: captured.paymentSession!.id,
      orderId: captured.order!.id,
      orderNumber: captured.order!.orderNumber,
      amount: String(captured.order!.cart.total),
      currency: 'SAR',
      channels: ['email'],
    })
    await notifyTicketIssued(notifications, {
      recipient,
      ticketSessionId: ticketSession.id,
      orderId: captured.order!.id,
      confirmationNumber: ticketSession.confirmationNumber,
      orderNumber: captured.order!.orderNumber,
      bookingSessionId: bookingSession.id,
      channels: ['email'],
    })
    expect(notifications.listSessions().length).toBeGreaterThanOrEqual(3)

    // 20–21. My Trips + confirmation document
    const manager = new TripManager({
      bookingOrchestrator: booking,
      paymentOrchestrator: payment,
      ticketOrchestrator: tickets,
      notificationOrchestrator: notifications,
    })
    const trip = manager.createTrip({
      userId: USER_ID,
      title: 'Japan Spring RC1',
      destination: 'Japan',
      destinations: ['Tokyo', 'Kyoto'],
      startDate: '2027-04-01',
      endDate: '2027-04-05',
      tripPlanId: decided.id,
      bookingSessionId: bookingSession.id,
      orderId: captured.order!.id,
      paymentSessionId: captured.paymentSession!.id,
      ticketSessionId: ticketSession.id,
      status: 'upcoming',
      itinerarySnapshot: {
        title: 'Japan Spring RC1',
        destinations: ['Tokyo', 'Kyoto'],
        notes: decided.summary,
      },
      estimatedTotal: captured.order!.cart.total,
      currency: 'SAR',
    })
    manager.saveTrip(USER_ID, trip.id)
    expect(manager.listAllUserTrips(USER_ID).map((t) => t.id)).toContain(trip.id)
    expect(manager.listSavedTrips(USER_ID).length).toBeGreaterThan(0)

    const dup = manager.duplicateItinerary(trip.id, USER_ID)
    expect(dup.id).not.toBe(trip.id)
    expect(dup.title.toLowerCase()).toMatch(/copy|نسخ/)

    const confirmation = buildConfirmationDocument(ticketSession)
    expect(confirmation.confirmationNumber).toBeTruthy()
    expect(confirmation.flightSegments.length + (confirmation.hotelName ? 1 : 0)).toBeGreaterThan(0)

    // 22. Cancel mock booking
    const cancelled = manager.cancelBooking(trip.id, USER_ID, 'RC1 cancel path')
    expect(cancelled.status).toBe('cancelled')

    // 23. Timeline + audit history
    const timeline = manager.getTimeline(trip.id, USER_ID)
    expect(timeline.length).toBeGreaterThan(0)
    expect(buildTripTimeline({ trip: cancelled }).length).toBeGreaterThan(0)
    expect(cancelled.audit.length).toBeGreaterThan(0)
  })
})
