/**
 * Sprint 37 — Travel Disruption & Smart Recovery Engine tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  TRAVEL_DISRUPTION_ENGINE_FEATURE_ID,
  createDisruptionDetector,
  createImpactCalculator,
  createRecoveryRanker,
  createRecoverySearcher,
  createTravelDisruptionEngine,
  createTripUpdateService,
  detectDisruptionConversationQuery,
  answerDisruptionQuery,
  isTravelDisruptionEngineEnabled,
  isDisruptionHandlingResult,
  type DisruptionContext,
  type DisruptionEventType,
} from '../disruption'
import { detectConversationCommand } from '../chat/conversationExperience/ConversationState'
import { ConversationController } from '../chat/conversationExperience/ConversationController'
import {
  createPostBookingService,
  createNotificationScheduler,
  resetPostBookingRepository,
  resetPostBookingService,
  resetTripManager,
  resetTripRepository,
} from '../trips'

const ALL_EVENTS: DisruptionEventType[] = [
  'flight_delayed',
  'flight_cancelled',
  'gate_changed',
  'schedule_changed',
  'missed_connection',
  'hotel_overbooking',
  'hotel_unavailable',
  'car_unavailable',
  'activity_cancelled',
  'airport_closure',
  'weather_disruption',
  'strike',
  'visa_rejection',
  'border_restriction',
]

function enableDisruptionChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('ai.concierge', true)
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.unified_travel_planner', true)
  registry.setEnabled('brain.conversation_ui', true)
  registry.setEnabled('brain.travel_execution_engine', true)
  registry.setEnabled('brain.payments_platform', true)
  registry.setEnabled('brain.trip_management', true)
  registry.setEnabled('brain.refund_policy_engine', true)
  registry.setEnabled('brain.travel_disruption_engine', true)
}

function baseContext(overrides: Partial<DisruptionContext> = {}): DisruptionContext {
  return {
    tripId: 'trip_s37',
    userId: 'user_s37',
    conversationId: 'conv_s37',
    destination: 'Dubai',
    origin: 'Riyadh',
    currency: 'SAR',
    hotelName: 'Marina Bay Hotel',
    flightConfirmation: 'FLT-S37',
    hotelConfirmation: 'HTL-S37',
    startDate: '2026-08-10',
    endDate: '2026-08-15',
    cabinClass: 'economy',
    hotelStars: 4,
    preferredAirlines: ['mock-flight-recovery'],
    preferredHotels: ['hotelbeds'],
    loyaltyPrograms: [],
    travelerProfile: 'leisure',
    familyTravel: false,
    businessTravel: false,
    visaRestricted: false,
    conversationNotes: ['Prefer morning departures'],
    currentDelayMinutes: 180,
    ...overrides,
  }
}

describe('Sprint 37 feature flags', () => {
  beforeEach(() => resetFeatureRegistry())
  afterEach(() => resetFeatureRegistry())

  it('registers brain.travel_disruption_engine disabled by default', () => {
    expect(getFeatureRegistry().isEnabled(TRAVEL_DISRUPTION_ENGINE_FEATURE_ID)).toBe(false)
    expect(isTravelDisruptionEngineEnabled()).toBe(false)
  })

  it('requires brain.refund_policy_engine before brain.travel_disruption_engine', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.travel_disruption_engine', true)
    expect(registry.isEnabled('brain.travel_disruption_engine')).toBe(false)
    enableDisruptionChain()
    expect(registry.isEnabled('brain.travel_disruption_engine')).toBe(true)
    expect(isTravelDisruptionEngineEnabled()).toBe(true)
  })

  it('feature definition depends on refund_policy_engine', () => {
    const def = getFeatureRegistry()
      .list()
      .find((f) => f.id === TRAVEL_DISRUPTION_ENGINE_FEATURE_ID)
    expect(def?.dependsOn).toContain('brain.refund_policy_engine')
    expect(def?.enabled).toBe(false)
  })
})

describe('DisruptionDetector', () => {
  const detector = createDisruptionDetector()

  it('detects all supported event types with severity', () => {
    for (const eventType of ALL_EVENTS) {
      const d = detector.detect({ eventType, context: baseContext() })
      expect(d.eventType).toBe(eventType)
      expect(['low', 'medium', 'high', 'critical']).toContain(d.severity)
      expect(d.disruptionId).toMatch(/^dis_/)
      expect(d.summary.length).toBeGreaterThan(3)
      expect(d.affectedServices.length).toBeGreaterThan(0)
    }
  })

  it('escalates long flight delays to high/critical', () => {
    const high = detector.detect({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 200,
    })
    expect(high.severity).toBe('high')
    const critical = detector.detect({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 400,
    })
    expect(critical.severity).toBe('critical')
  })

  it('maps user text to disruption types', () => {
    expect(detector.detectFromUserText('My flight is delayed')).toBe('flight_delayed')
    expect(detector.detectFromUserText('My flight was cancelled')).toBe('flight_cancelled')
    expect(detector.detectFromUserText('I missed my connection')).toBe('missed_connection')
    expect(detector.detectFromUserText('My hotel cancelled my reservation')).toBe(
      'hotel_unavailable',
    )
    expect(detector.detectFromUserText('Hotel overbooked us')).toBe('hotel_overbooking')
    expect(detector.detectFromUserText('Gate has changed')).toBe('gate_changed')
    expect(detector.detectFromUserText('Airport is closed')).toBe('airport_closure')
    expect(detector.detectFromUserText('Visa was rejected')).toBe('visa_rejection')
    expect(detector.detectFromUserText('hello')).toBeNull()
  })
})

describe('Impact, recovery search, and ranking', () => {
  it('calculates passenger impact for delayed flights', () => {
    const disruption = createDisruptionDetector().detect({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 180,
    })
    const impact = createImpactCalculator().calculate(disruption, baseContext())
    expect(impact.travelersAffected).toBeGreaterThanOrEqual(1)
    expect(impact.hotelSameDayImpact).toBe(true)
    expect(impact.stressScore).toBeGreaterThan(0)
    expect(impact.summary).toContain('traveler')
  })

  it('searches alternative flight hotel car activity transport and route', () => {
    const disruption = createDisruptionDetector().detect({
      eventType: 'flight_cancelled',
      context: baseContext(),
      delayMinutes: 720,
    })
    const options = createRecoverySearcher().search(disruption, baseContext())
    const kinds = new Set(options.map((o) => o.kind))
    expect(kinds.has('alternative_flight')).toBe(true)
    expect(kinds.has('alternative_route')).toBe(true)
    expect(kinds.has('alternative_hotel')).toBe(true)
    expect(kinds.has('alternative_transport')).toBe(true)
    expect(kinds.has('alternative_activity')).toBe(true)
  })

  it('searches car alternative for car unavailable', () => {
    const disruption = createDisruptionDetector().detect({
      eventType: 'car_unavailable',
      context: baseContext(),
    })
    const options = createRecoverySearcher().search(disruption, baseContext())
    expect(options.some((o) => o.kind === 'alternative_car')).toBe(true)
  })

  it('ranks plans using cost arrival preferences cabin hotel and traveler type', () => {
    const ctx = baseContext({
      businessTravel: true,
      preferredAirlines: ['mock-flight-recovery'],
      cabinClass: 'economy',
      hotelStars: 4,
      loyaltyPrograms: ['SkyMiles'],
      visaRestricted: true,
    })
    const disruption = createDisruptionDetector().detect({
      eventType: 'missed_connection',
      context: ctx,
      delayMinutes: 240,
    })
    const impact = createImpactCalculator().calculate(disruption, ctx)
    const options = createRecoverySearcher().search(disruption, ctx)
    const plans = createRecoveryRanker().rank(options, disruption, ctx, impact)
    expect(plans.length).toBeGreaterThan(0)
    expect(plans[0].rank).toBe(1)
    expect(plans[0].score).toBeGreaterThan(0)
    expect(plans[0].factors.lowest_total_cost).toBeDefined()
    expect(plans[0].factors.earliest_arrival).toBeDefined()
    expect(plans[0].factors.minimum_disruption).toBeDefined()
    expect(plans[0].factors.traveler_preferences).toBeDefined()
    expect(plans[0].factors.loyalty_programs).toBeDefined()
    expect(plans[0].factors.cabin_class).toBeDefined()
    expect(plans[0].factors.hotel_rating).toBeDefined()
    expect(plans[0].factors.family_business_traveler).toBeDefined()
    expect(plans[0].factors.visa_restrictions).toBeDefined()
    expect(plans[0].factors.conversation_context).toBeDefined()
    expect(plans[0].explanation).toContain('Rank #1')
  })

  it('prefers lower residual delay for business travelers', () => {
    const ctx = baseContext({ businessTravel: true, travelerProfile: 'business' })
    const disruption = createDisruptionDetector().detect({
      eventType: 'flight_delayed',
      context: ctx,
      delayMinutes: 180,
    })
    const impact = createImpactCalculator().calculate(disruption, ctx)
    const options = createRecoverySearcher().search(disruption, ctx)
    const plans = createRecoveryRanker().rank(options, disruption, ctx, impact)
    expect(plans[0].reasons.some((r) => /business/i.test(r))).toBe(true)
  })
})

describe('TravelDisruptionEngine orchestration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })

  it('returns FEATURE_DISABLED when flag override is off', () => {
    const engine = createTravelDisruptionEngine({ enabled: false })
    const result = engine.handle({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 180,
    })
    expect('ok' in result && result.ok === false).toBe(true)
    if ('ok' in result) {
      expect(result.code).toBe('FEATURE_DISABLED')
    }
  })

  it('handles every disruption event end-to-end', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    for (const eventType of ALL_EVENTS) {
      const result = engine.handle({
        eventType,
        context: baseContext(),
        delayMinutes: eventType === 'gate_changed' ? 0 : 180,
      })
      expect(isDisruptionHandlingResult(result)).toBe(true)
      if (!isDisruptionHandlingResult(result)) continue
      expect(result.disruption.eventType).toBe(eventType)
      expect(result.impact.summary.length).toBeGreaterThan(0)
      expect(result.plans.length).toBeGreaterThan(0)
      expect(result.selectedPlan).not.toBeNull()
      expect(result.tripUpdate?.itineraryUpdated).toBe(true)
      expect(result.explanation.length).toBeGreaterThan(10)
      expect(result.confidenceScore).toBeGreaterThan(0)
      expect(typeof result.estimatedExtraCost).toBe('number')
      expect(typeof result.estimatedDelayMinutes).toBe('number')
      expect(result.applied).toBe(true)
    }
  })

  it('explains flight delay recovery naturally with zero extra cost path', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handle({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 180,
      locale: 'en',
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.explanation).toContain('Your flight was delayed by 3 hours.')
    expect(result.explanation).toMatch(/hotel check-in has been updated/i)
    expect(result.explanation).toMatch(/airport transfer/i)
    expect(result.explanation).toMatch(/activities were shifted/i)
    expect(result.explanation).toMatch(/Estimated additional cost/i)
  })

  it('explains in Arabic when locale is ar', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handle({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 180,
      locale: 'ar',
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.explanation).toContain('التكلفة الإضافية')
  })

  it('updates hotel dates activities transportation reminders and documents', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handle({
      eventType: 'flight_cancelled',
      context: baseContext(),
      delayMinutes: 720,
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    const update = result.tripUpdate!
    expect(update.itineraryUpdated).toBe(true)
    expect(update.hotelDatesMoved).toBe(true)
    expect(update.activitiesMoved).toBe(true)
    expect(update.transportationUpdated).toBe(true)
    expect(update.remindersUpdated).toBe(true)
    expect(update.documentsRegenerated).toBe(true)
    expect(update.newCheckInDate).toBe('2026-08-11')
    expect(update.notes.length).toBeGreaterThan(2)
  })

  it('notifies the user via NotificationScheduler', () => {
    const notifications = createNotificationScheduler()
    const engine = createTravelDisruptionEngine({
      enabled: true,
      notifications,
    })
    const result = engine.handle({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 120,
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.notifications.length).toBe(1)
    expect(result.notifications[0].trigger).toBe('flight_delay')
    expect(notifications.listForTrip('trip_s37').length).toBe(1)
  })

  it('handleFromUserText detects and recovers without forms', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handleFromUserText({
      userText: 'My flight is delayed by 3 hours',
      context: baseContext(),
      delayMinutes: 180,
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.disruption.eventType).toBe('flight_delayed')
    expect(result.applied).toBe(true)
  })

  it('returns NO_DISRUPTION_DETECTED for unrelated text', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handleFromUserText({
      userText: 'What is the weather in Paris?',
      context: baseContext(),
    })
    expect('ok' in result && result.ok === false).toBe(true)
    if ('ok' in result) expect(result.code).toBe('NO_DISRUPTION_DETECTED')
  })

  it('records metrics and events', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    engine.handle({
      eventType: 'strike',
      context: baseContext(),
      delayMinutes: 300,
    })
    const metrics = engine.getMetrics()
    expect(metrics.disruptionsDetected).toBe(1)
    expect(metrics.recoveriesGenerated).toBeGreaterThan(0)
    expect(metrics.plansApplied).toBe(1)
    expect(metrics.byEventType.strike).toBe(1)
    const events = engine.getRecentEvents()
    expect(events.some((e) => e.type === 'DisruptionDetected')).toBe(true)
    expect(events.some((e) => e.type === 'RecoveryPlanSelected')).toBe(true)
    expect(events.some((e) => e.type === 'TripUpdated')).toBe(true)
    expect(events.some((e) => e.type === 'DisruptionHandled')).toBe(true)
  })

  it('can skip trip update when autoApplyBestPlan is false', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handle({
      eventType: 'gate_changed',
      context: baseContext(),
      autoApplyBestPlan: false,
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.applied).toBe(false)
    expect(result.tripUpdate).toBeNull()
    expect(result.selectedPlan).not.toBeNull()
  })

  it('soft-links PostBookingService when present', () => {
    const postBooking = createPostBookingService({ enabled: true })
    const trip = postBooking.createMyTrip({
      userId: 'user_s37',
      destination: 'Dubai',
      currency: 'SAR',
      totalPaid: 5000,
      hotelName: 'Marina Bay Hotel',
      startDate: '2026-08-10',
      endDate: '2026-08-15',
      references: {
        bookingReference: 'RHL-BKG-S37',
        tripReference: 'RHL-TRP-S37',
        paymentReference: 'RHL-PAY-S37',
        flightConfirmation: 'FLT-S37',
        hotelConfirmation: 'HTL-S37',
        executionSessionId: null,
        paymentSessionId: 'ps_s37',
      },
    })
    const updater = createTripUpdateService(postBooking)
    const disruption = createDisruptionDetector().detect({
      eventType: 'flight_delayed',
      context: baseContext({ tripId: trip.tripId }),
      delayMinutes: 180,
    })
    const impact = createImpactCalculator().calculate(
      disruption,
      baseContext({ tripId: trip.tripId }),
    )
    const plans = createRecoveryRanker().rank(
      createRecoverySearcher().search(disruption, baseContext({ tripId: trip.tripId })),
      disruption,
      baseContext({ tripId: trip.tripId }),
      impact,
    )
    const update = updater.apply(
      disruption,
      baseContext({ tripId: trip.tripId }),
      impact,
      plans[0],
    )
    expect(update.notes.some((n) => /Linked My Trip/i.test(n))).toBe(true)
  })
})

describe('Conversation disruption integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })

  it('detects disruption conversation commands', () => {
    expect(detectConversationCommand('My flight is delayed')).toBe('flight_delayed')
    expect(detectConversationCommand('My flight was cancelled')).toBe('flight_cancelled')
    expect(detectConversationCommand('I missed my connection')).toBe('missed_connection')
    expect(detectConversationCommand('My hotel cancelled my reservation')).toBe(
      'hotel_cancelled',
    )
    expect(detectConversationCommand('Gate has changed')).toBe('gate_changed')
    expect(detectConversationCommand('Airport is closed')).toBe('airport_closure')
    expect(detectConversationCommand('What happens if my flight is delayed?')).toBe(
      'flight_delay_policy',
    )
    expect(detectConversationCommand('Any delays?')).toBe('any_delays')
  })

  it('detectDisruptionConversationQuery covers recovery phrases', () => {
    expect(detectDisruptionConversationQuery('My flight is delayed')).toBe('flight_delayed')
    expect(detectDisruptionConversationQuery('My flight was cancelled')).toBe('flight_cancelled')
    expect(detectDisruptionConversationQuery('I missed my connection')).toBe(
      'missed_connection',
    )
    expect(detectDisruptionConversationQuery('My hotel cancelled my reservation')).toBe(
      'hotel_cancelled',
    )
    expect(detectDisruptionConversationQuery('What happens if my flight is delayed?')).toBeNull()
  })

  it('answerDisruptionQuery returns natural explanation', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const text = answerDisruptionQuery({
      kind: 'flight_delayed',
      engine,
      context: baseContext(),
      delayMinutes: 180,
    })
    expect(text).toContain('Your flight was delayed by 3 hours.')
    expect(text).toContain('Estimated additional cost')
  })

  it('ConversationController invokes TravelDisruptionEngine when flag on', async () => {
    enableDisruptionChain()
    const postBooking = createPostBookingService({ enabled: true })
    postBooking.createMyTrip({
      userId: 'user_chat_s37',
      destination: 'Dubai',
      currency: 'SAR',
      totalPaid: 4200,
      hotelName: 'Hilton Dubai',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      references: {
        bookingReference: 'RHL-BKG-CHAT',
        tripReference: 'RHL-TRP-CHAT',
        paymentReference: 'RHL-PAY-CHAT',
        flightConfirmation: 'FLT-CHAT',
        hotelConfirmation: 'HTL-CHAT',
        executionSessionId: null,
        paymentSessionId: 'ps_chat',
      },
    })
    const controller = ConversationController({
      enabled: true,
      postBookingService: postBooking,
      disruptionEngine: createTravelDisruptionEngine({
        enabled: true,
        postBooking,
        notifications: postBooking.getNotificationScheduler(),
      }),
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_disruption_s37',
      userId: 'user_chat_s37',
      userText: 'My flight is delayed by 3 hours',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('flight_delayed')
    expect(turn.assistantMessage.meta?.travelDisruption).toBe(true)
    expect(turn.renderedText).toContain('Your flight was delayed by 3 hours.')
    expect(turn.renderedText).toMatch(/Estimated additional cost/i)
  })

  it('handles cancelled flight and missed connection in conversation', async () => {
    enableDisruptionChain()
    const controller = ConversationController({
      enabled: true,
      disruptionEngine: createTravelDisruptionEngine({ enabled: true }),
      skipPlannerOrchestrator: true,
    })
    const cancelled = await controller.handleTurn({
      conversationId: 'conv_cancel_s37',
      userId: 'u1',
      userText: 'My flight was cancelled',
      locale: 'en',
    })
    expect(cancelled.commandKind).toBe('flight_cancelled')
    expect(cancelled.renderedText.length).toBeGreaterThan(20)

    const missed = await controller.handleTurn({
      conversationId: 'conv_miss_s37',
      userId: 'u1',
      userText: 'I missed my connection',
      locale: 'en',
    })
    expect(missed.commandKind).toBe('missed_connection')
    expect(missed.assistantMessage.meta?.travelDisruption).toBe(true)
  })

  it('does not invoke disruption engine when feature flag is off', async () => {
    resetFeatureRegistry()
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.conversation_ui', true)
    // leave travel_disruption_engine off
    const controller = ConversationController({
      enabled: true,
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_flag_off_s37',
      userId: 'u1',
      userText: 'My flight is delayed',
      locale: 'en',
    })
    expect(turn.assistantMessage.meta?.travelDisruption).not.toBe(true)
  })
})

describe('Family traveler recovery scoring', () => {
  it('includes family-friendly reason when familyTravel is set', () => {
    const ctx = baseContext({ familyTravel: true, travelerProfile: 'family' })
    const disruption = createDisruptionDetector().detect({
      eventType: 'flight_delayed',
      context: ctx,
      delayMinutes: 120,
    })
    const impact = createImpactCalculator().calculate(disruption, ctx)
    const plans = createRecoveryRanker().rank(
      createRecoverySearcher().search(disruption, ctx),
      disruption,
      ctx,
      impact,
    )
    expect(plans[0].reasons.some((r) => /family/i.test(r))).toBe(true)
  })
})

describe('Per-event recovery coverage', () => {
  const engine = createTravelDisruptionEngine({ enabled: true })

  it.each(ALL_EVENTS)('produces recovery options and explanation for %s', (eventType) => {
    const result = engine.handle({
      eventType,
      context: baseContext({
        currentDelayMinutes: eventType === 'gate_changed' ? 0 : 200,
      }),
      delayMinutes: eventType === 'gate_changed' ? 0 : 200,
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.plans.flatMap((p) => p.options).length).toBeGreaterThan(0)
    expect(result.explanation).toBeTruthy()
    expect(result.disruption.severity).toBeTruthy()
  })
})

describe('Hotel and activity disruption recovery', () => {
  it('recovers hotel overbooking with alternative hotel plan', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handle({
      eventType: 'hotel_overbooking',
      context: baseContext(),
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.selectedPlan?.options.some((o) => o.kind === 'alternative_hotel')).toBe(true)
    expect(result.tripUpdate?.hotelDatesMoved).toBe(true)
  })

  it('recovers activity cancellation with shifted activity', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handle({
      eventType: 'activity_cancelled',
      context: baseContext(),
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    expect(result.plans.some((p) => p.options.some((o) => o.kind === 'alternative_activity'))).toBe(
      true,
    )
    expect(result.tripUpdate?.activitiesMoved).toBe(true)
  })

  it('recovers weather and border restriction with critical severity', () => {
    const detector = createDisruptionDetector()
    expect(detector.detect({ eventType: 'weather_disruption', context: baseContext() }).severity).toBe(
      'high',
    )
    expect(detector.detect({ eventType: 'border_restriction', context: baseContext() }).severity).toBe(
      'critical',
    )
    expect(detector.detect({ eventType: 'airport_closure', context: baseContext() }).severity).toBe(
      'critical',
    )
  })
})

describe('Conversation hotel cancellation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetPostBookingService()
    resetPostBookingRepository()
    resetTripManager()
    resetTripRepository()
  })

  it('handles hotel cancelled reservation in conversation', async () => {
    enableDisruptionChain()
    const controller = ConversationController({
      enabled: true,
      disruptionEngine: createTravelDisruptionEngine({ enabled: true }),
      skipPlannerOrchestrator: true,
    })
    const turn = await controller.handleTurn({
      conversationId: 'conv_hotel_s37',
      userId: 'u_hotel',
      userText: 'My hotel cancelled my reservation',
      locale: 'en',
    })
    expect(turn.commandKind).toBe('hotel_cancelled')
    expect(turn.assistantMessage.meta?.travelDisruption).toBe(true)
    expect(turn.renderedText).toMatch(/Estimated additional cost/i)
  })
})

describe('Zero-cost delayed flight sample explanation', () => {
  it('matches the product sample narrative shape', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    const result = engine.handle({
      eventType: 'flight_delayed',
      context: baseContext({ currency: 'SAR' }),
      delayMinutes: 180,
    })
    expect(isDisruptionHandlingResult(result)).toBe(true)
    if (!isDisruptionHandlingResult(result)) return
    const lines = result.explanation.split('\n')
    expect(lines[0]).toBe('Your flight was delayed by 3 hours.')
    expect(result.explanation).toContain('Your hotel check-in has been updated')
    expect(result.explanation).toContain('A new airport transfer has been reserved.')
    expect(result.explanation).toContain('Your activities were shifted to tomorrow.')
    expect(result.explanation).toMatch(/Estimated additional cost: SAR \d+/)
  })

  it('exposes isEnabled from registry and override', () => {
    resetFeatureRegistry()
    const off = createTravelDisruptionEngine()
    expect(off.isEnabled()).toBe(false)
    const on = createTravelDisruptionEngine({ enabled: true })
    expect(on.isEnabled()).toBe(true)
    expect(on.detectFromUserText('I missed my connection')).toBe('missed_connection')
  })

  it('tracks zero-cost recoveries in metrics when plan costs nothing', () => {
    const engine = createTravelDisruptionEngine({ enabled: true })
    engine.handle({
      eventType: 'flight_delayed',
      context: baseContext(),
      delayMinutes: 180,
    })
    const metrics = engine.getMetrics()
    expect(metrics.zeroCostRecoveries).toBeGreaterThanOrEqual(0)
    expect(metrics.averageConfidence).toBeGreaterThan(0)
  })
})
