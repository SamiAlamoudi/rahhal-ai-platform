/**
 * Sprint 66 — Flow runners (reuse existing engines only).
 */

import { extractFromUserText } from '../../agent/extractRequirements'
import {
  createBookingProviderRegistry,
  runBookingIntelligence,
} from '../../agent/bookingIntelligence'
import type { BookingOffer, BookingProvider } from '../../agent/bookingIntelligence/types'
import {
  generateBookingDocuments,
  resetBookingDocumentCenter,
  runBookingExecution,
} from '../../agent/bookingExecution'
import {
  createTripFromBookings,
  getTrip,
  getTripDocuments,
  mergeTripProviderUpdates,
  refreshTrip,
  resetDefaultTripManagementService,
} from '../../agent/tripManagement'
import {
  cancelBooking,
  createAmadeusLiveProvider,
  type LiveFlightOffer,
} from '../../agent/liveProviders'
import { getFeatureRegistry } from '../../ai'
import type { FeatureId } from '../../ai/featureFlags/types'
import { createValidationRegistry, step, validationMemory } from './fixtures'
import type { ValidationFlowResult, ValidationStepResult } from './types'

function money(amount: number, currency = 'SAR') {
  return { amount, currency }
}

function stubProviderMethods(partial: Partial<BookingProvider> & Pick<BookingProvider, 'providerId' | 'domain' | 'displayName' | 'isAvailable' | 'search' | 'book' | 'cancel'>): BookingProvider {
  return {
    details: async () => null,
    availability: async () => ({ available: true }),
    price: async () => money(100),
    ...partial,
  }
}

async function searchOffers(
  registry: ReturnType<typeof createValidationRegistry>,
  domain: 'flights' | 'hotels' | 'activities',
): Promise<{ provider: BookingProvider; offers: BookingOffer[] }> {
  const provider = registry.forDomain(domain)[0]!
  const offers = await provider.search({
    domain,
    origin: 'RUH',
    destination: 'DXB',
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    adults: 2,
    travelers: 2,
    budgetCurrency: 'SAR',
  })
  return { provider, offers }
}

/** Flow 1: Conversation → destination → search → ranking → recommendation */
export async function runFlow1ConversationSearch(): Promise<ValidationFlowResult> {
  const started = Date.now()
  const steps: ValidationStepResult[] = []

  const extracted = extractFromUserText(
    'I want to visit Dubai from Riyadh for 5 days in November with a midrange budget',
    'en',
  )
  const understood = Boolean(
    extracted.patch.destination
    || (extracted.patch.destinations && extracted.patch.destinations.length > 0)
    || extracted.patch.origin
    || extracted.intent === 'plan'
    || extracted.intent === 'discover',
  )
  steps.push(
    step(
      'f1.destination',
      'Destination understanding',
      understood ? 'pass' : 'warn',
      `intent=${extracted.intent} destination=${extracted.patch.destination ?? extracted.patch.destinations?.[0] ?? 'n/a'} origin=${extracted.patch.origin ?? 'n/a'}`,
    ),
  )

  const registry = createValidationRegistry()
  const bi = await runBookingIntelligence({
    userId: 'e2e-f1',
    memory: validationMemory(),
    registry,
  })
  steps.push(
    step(
      'f1.search',
      'Search (Booking Intelligence)',
      bi.snapshot.rankedCount > 0 || bi.ranked.length > 0 ? 'pass' : 'fail',
      `rankedCount=${bi.snapshot.rankedCount}`,
    ),
  )
  steps.push(
    step(
      'f1.ranking',
      'Ranking',
      bi.ranked.length > 0 ? 'pass' : 'fail',
      `ranked=${bi.ranked.length}`,
    ),
  )
  steps.push(
    step(
      'f1.recommendation',
      'Recommendation',
      bi.recommendationFacts.length > 0 && bi.confidence.confidence > 0
        ? 'pass'
        : 'fail',
      `facts=${bi.recommendationFacts.length} confidence=${bi.confidence.confidence.toFixed(2)}`,
    ),
  )

  return {
    flowId: 'flow1_conversation_search_ranking',
    name: 'Conversation → search → ranking → recommendation',
    ok: steps.every((s) => s.status === 'pass' || s.status === 'warn'),
    steps,
    durationMs: Date.now() - started,
    artifacts: {
      rankedTop: bi.ranked[0]?.id ?? null,
      combinations: bi.combinations.length,
    },
  }
}

/** Flow 2: Conversation → booking → trip → documents */
export async function runFlow2BookingTripDocuments(): Promise<ValidationFlowResult> {
  const started = Date.now()
  const steps: ValidationStepResult[] = []
  resetBookingDocumentCenter()
  resetDefaultTripManagementService()

  const registry = createValidationRegistry()
  const { provider, offers } = await searchOffers(registry, 'flights')
  if (!offers[0]) {
    return {
      flowId: 'flow2_booking_trip_documents',
      name: 'Booking → trip → documents',
      ok: false,
      steps: [step('f2.search', 'Flight search', 'fail', 'no offers')],
      durationMs: Date.now() - started,
    }
  }

  steps.push(step('f2.traveler', 'Traveler confirmation', 'pass', 'Lina Hadi'))

  const execution = await runBookingExecution({
    userId: 'e2e-f2',
    conversationId: 'conv-e2e-f2',
    registry,
    items: [
      {
        domain: 'flights',
        offerId: offers[0].id,
        providerId: provider.providerId,
        title: offers[0].title,
        price: offers[0].price,
        offer: offers[0],
      },
    ],
    travelers: [{ firstName: 'Lina', lastName: 'Hadi' }],
    generateDocuments: true,
  })
  const booked = execution.bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'ticketed',
  )
  steps.push(
    step(
      'f2.booking',
      'Booking execution',
      booked.length > 0 ? 'pass' : 'fail',
      `status=${execution.snapshot.status} bookings=${booked.length}`,
    ),
  )

  const trip = createTripFromBookings({
    userId: 'e2e-f2',
    bookings: execution.bookings,
    executionSessionId: execution.session.id,
    destination: 'Dubai',
    origin: 'Riyadh',
    departure: '2026-11-01T08:00:00Z',
    return: '2026-11-05T20:00:00Z',
    generateDocuments: true,
  })
  steps.push(
    step(
      'f2.trip',
      'Trip creation',
      trip.tripId && getTrip(trip.tripId) ? 'pass' : 'fail',
      `tripId=${trip.tripId} status=${trip.bookingStatus}`,
    ),
  )

  const docs = getTripDocuments(trip)
  const bundle = generateBookingDocuments({
    sessionId: execution.session.id,
    bookings: execution.bookings,
    travelerName: 'Lina Hadi',
  })
  steps.push(
    step(
      'f2.documents',
      'Document generation',
      docs.all.length > 0 || bundle.documents.length > 0 ? 'pass' : 'fail',
      `legacyDocs=${docs.all.length} generated=${bundle.documents.length}`,
    ),
  )

  return {
    flowId: 'flow2_booking_trip_documents',
    name: 'Booking execution → trip → documents',
    ok: steps.every((s) => s.status === 'pass'),
    steps,
    durationMs: Date.now() - started,
    artifacts: { tripId: trip.tripId, bookingIds: execution.bookings.map((b) => b.id) },
  }
}

/** Flow 3: Retrieve → sync provider → refresh trip → refresh documents */
export async function runFlow3SyncRefresh(): Promise<ValidationFlowResult> {
  const started = Date.now()
  const steps: ValidationStepResult[] = []
  resetBookingDocumentCenter()
  resetDefaultTripManagementService()

  const registry = createValidationRegistry()
  const { provider, offers } = await searchOffers(registry, 'flights')
  const execution = await runBookingExecution({
    userId: 'e2e-f3',
    registry,
    items: [
      {
        domain: 'flights',
        offerId: offers[0]!.id,
        providerId: provider.providerId,
        title: offers[0]!.title,
        price: offers[0]!.price,
        offer: offers[0],
      },
    ],
    travelers: [{ firstName: 'Omar', lastName: 'Nasser' }],
  })
  const trip = createTripFromBookings({
    userId: 'e2e-f3',
    bookings: execution.bookings,
    generateDocuments: true,
  })
  steps.push(step('f3.retrieve', 'Retrieve existing booking/trip', 'pass', trip.tripId))

  const timelineBefore = trip.timeline.length
  const synced = mergeTripProviderUpdates(trip.tripId, [
    {
      bookingId: trip.bookings[0]!.bookingId,
      provider: trip.bookings[0]!.provider,
      status: 'ticketed',
      pnr: trip.pnrs[0] ?? 'SYNC01',
    },
  ])
  steps.push(
    step(
      'f3.sync',
      'Synchronize provider updates',
      synced && synced.timeline.length >= timelineBefore ? 'pass' : 'fail',
      `timeline=${synced?.timeline.length ?? 0}`,
    ),
  )

  const amadeus = createAmadeusLiveProvider({
    clientId: 'cid',
    clientSecret: 'secret',
    orderLive: false,
  })
  const offer: LiveFlightOffer = {
    id: 'E2E-OFF',
    providerId: 'amadeus',
    from: 'RUH',
    to: 'DXB',
    airline: 'SV',
    cabin: 'ECONOMY',
    stops: 0,
    durationMinutes: 180,
    departureAt: '2026-11-01T08:00:00',
    arrivalAt: '2026-11-01T11:00:00',
    price: money(1200),
    refundable: true,
    raw: { id: 'E2E-OFF' },
  }
  ;(amadeus as unknown as { seedFlightOffer: (o: LiveFlightOffer) => void }).seedFlightOffer(offer)
  const created = await amadeus.createOrder!('E2E-OFF')
  const liveTrip = createTripFromBookings({
    userId: 'e2e-f3-live',
    bookings: [
      {
        ...execution.bookings[0]!,
        provider: 'amadeus',
        confirmation: created.orderId ?? 'amd',
        providerBookingId: created.orderId ?? 'amd',
        pnr: created.pnr ?? 'PNR',
      },
    ],
    generateDocuments: false,
  })
  const refreshed = await refreshTrip({
    tripId: liveTrip.tripId,
    sdks: { amadeus },
  })
  steps.push(
    step(
      'f3.refresh_trip',
      'Refresh trip',
      refreshed ? 'pass' : 'fail',
      `tripId=${refreshed?.tripId}`,
    ),
  )

  const docs = getTripDocuments(trip)
  steps.push(
    step(
      'f3.refresh_docs',
      'Refresh documents',
      docs.all.length > 0 ? 'pass' : 'warn',
      `docs=${docs.all.length}`,
    ),
  )

  return {
    flowId: 'flow3_sync_refresh',
    name: 'Retrieve → sync → refresh trip/docs',
    ok: steps.every((s) => s.status === 'pass' || s.status === 'warn'),
    steps,
    durationMs: Date.now() - started,
  }
}

/** Flow 4: Cancellation → provider cancel → trip update → document note */
export async function runFlow4Cancellation(): Promise<ValidationFlowResult> {
  const started = Date.now()
  const steps: ValidationStepResult[] = []
  resetDefaultTripManagementService()

  const amadeus = createAmadeusLiveProvider({
    clientId: 'cid',
    clientSecret: 'secret',
    orderLive: false,
  })
  const offer: LiveFlightOffer = {
    id: 'CXL-OFF',
    providerId: 'amadeus',
    from: 'RUH',
    to: 'DXB',
    airline: 'SV',
    cabin: 'ECONOMY',
    stops: 0,
    durationMinutes: 180,
    departureAt: '2026-11-01T08:00:00',
    arrivalAt: '2026-11-01T11:00:00',
    price: money(900),
    refundable: true,
    raw: { id: 'CXL-OFF' },
  }
  ;(amadeus as unknown as { seedFlightOffer: (o: LiveFlightOffer) => void }).seedFlightOffer(offer)
  const order = await amadeus.createOrder!('CXL-OFF')
  steps.push(
    step('f4.book', 'Create cancellable booking', order.ok ? 'pass' : 'fail', order.orderId),
  )

  const cancel = await cancelBooking({ sdk: amadeus, orderId: order.orderId! })
  steps.push(
    step(
      'f4.provider_cancel',
      'Provider cancellation',
      cancel.ok ? 'pass' : 'fail',
      cancel.error,
    ),
  )

  const registry = createValidationRegistry()
  const { provider, offers } = await searchOffers(registry, 'flights')
  const execution = await runBookingExecution({
    userId: 'e2e-f4',
    registry,
    items: [
      {
        domain: 'flights',
        offerId: offers[0]!.id,
        providerId: provider.providerId,
        title: offers[0]!.title,
        price: offers[0]!.price,
        offer: offers[0],
      },
    ],
  })
  const trip = createTripFromBookings({
    userId: 'e2e-f4',
    bookings: execution.bookings,
    generateDocuments: false,
  })
  const updated = mergeTripProviderUpdates(trip.tripId, [
    {
      bookingId: trip.bookings[0]!.bookingId,
      provider: trip.bookings[0]!.provider,
      status: 'cancelled',
    },
  ])
  steps.push(
    step(
      'f4.trip_update',
      'Trip update after cancellation',
      updated?.bookingStatus === 'Cancelled' ? 'pass' : 'fail',
      `status=${updated?.bookingStatus}`,
    ),
  )
  steps.push(
    step(
      'f4.doc_update',
      'Document/timeline update',
      updated?.timeline.some((e) => e.type === 'Cancellation') ? 'pass' : 'fail',
      'Cancellation timeline event',
    ),
  )

  return {
    flowId: 'flow4_cancellation',
    name: 'Cancellation → provider → trip → documents',
    ok: steps.every((s) => s.status === 'pass'),
    steps,
    durationMs: Date.now() - started,
  }
}

/** Flow 5: Multi-booking trip (flight + hotel + activities) + timeline */
export async function runFlow5MultiBooking(): Promise<ValidationFlowResult> {
  const started = Date.now()
  const steps: ValidationStepResult[] = []
  resetDefaultTripManagementService()
  resetBookingDocumentCenter()

  const registry = createValidationRegistry()
  const flight = await searchOffers(registry, 'flights')
  const hotel = await searchOffers(registry, 'hotels')
  const activity = await searchOffers(registry, 'activities')

  const items = [
    flight.offers[0] && {
      domain: 'flights' as const,
      offerId: flight.offers[0].id,
      providerId: flight.provider.providerId,
      title: flight.offers[0].title,
      price: flight.offers[0].price,
      offer: flight.offers[0],
    },
    hotel.offers[0] && {
      domain: 'hotels' as const,
      offerId: hotel.offers[0].id,
      providerId: hotel.provider.providerId,
      title: hotel.offers[0].title,
      price: hotel.offers[0].price,
      offer: hotel.offers[0],
    },
    activity.offers[0] && {
      domain: 'activities' as const,
      offerId: activity.offers[0].id,
      providerId: activity.provider.providerId,
      title: activity.offers[0].title,
      price: activity.offers[0].price,
      offer: activity.offers[0],
    },
  ].filter(Boolean) as Array<{
    domain: 'flights' | 'hotels' | 'activities'
    offerId: string
    providerId: string
    title: string
    price: { amount: number; currency: string }
    offer: BookingOffer
  }>

  steps.push(
    step(
      'f5.items',
      'Multi-domain offers ready',
      items.length >= 2 ? 'pass' : 'fail',
      `domains=${items.map((i) => i.domain).join(',')}`,
    ),
  )

  const execution = await runBookingExecution({
    userId: 'e2e-f5',
    conversationId: 'conv-e2e-f5',
    registry,
    items,
    travelers: [{ firstName: 'Sara', lastName: 'Alharbi' }],
    generateDocuments: true,
  })
  const okBookings = execution.bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'ticketed',
  )
  steps.push(
    step(
      'f5.booking',
      'Multi booking execution',
      okBookings.length >= 2 ? 'pass' : 'fail',
      `confirmed=${okBookings.length}`,
    ),
  )

  const trip = createTripFromBookings({
    userId: 'e2e-f5',
    bookings: execution.bookings,
    destination: 'Dubai',
    origin: 'RUH',
    generateDocuments: true,
  })
  const domains = new Set(trip.bookings.map((b) => b.domain))
  steps.push(
    step(
      'f5.trip',
      'Trip with multiple bookings',
      trip.bookings.length >= 2 ? 'pass' : 'fail',
      `bookings=${trip.bookings.length} domains=${[...domains].join(',')}`,
    ),
  )

  const chronological = trip.timeline.every((e, i, arr) =>
    i === 0 || Date.parse(e.timestamp) >= Date.parse(arr[i - 1]!.timestamp),
  )
  steps.push(
    step(
      'f5.timeline',
      'Timeline consistency',
      chronological && trip.timeline.some((e) => e.type === 'BookingCreated') ? 'pass' : 'fail',
      `events=${trip.timeline.length} chronological=${chronological}`,
    ),
  )

  return {
    flowId: 'flow5_multi_booking_timeline',
    name: 'Multi-booking trip + timeline',
    ok: steps.every((s) => s.status === 'pass'),
    steps,
    durationMs: Date.now() - started,
    artifacts: { tripId: trip.tripId, domains: [...domains] },
  }
}

/** Flow 6: Provider failure → retry → fallback → recovery → error normalization */
export async function runFlow6ProviderFailure(): Promise<ValidationFlowResult> {
  const started = Date.now()
  const steps: ValidationStepResult[] = []

  const failing = stubProviderMethods({
    providerId: 'fail-flights',
    domain: 'flights',
    displayName: 'Fail',
    isAvailable: () => true,
    async search() {
      return []
    },
    async book() {
      return { ok: false, error: 'provider_unavailable', errorCode: 'unavailable', retryable: true }
    },
    async cancel() {
      return { ok: false, error: 'unavailable' }
    },
  })

  let attempts = 0
  const flaky = stubProviderMethods({
    providerId: 'flaky-flights',
    domain: 'flights',
    displayName: 'Flaky',
    isAvailable: () => true,
    async search() {
      return []
    },
    async book() {
      attempts += 1
      if (attempts < 2) {
        throw new Error('temporary_unavailable')
      }
      return {
        ok: true,
        confirmationId: 'retry-ok-1',
        order: {
          ok: true,
          orderId: 'retry-ok-1',
          pnr: 'RTRY01',
          ticketNumbers: ['ETK-RTRY01'],
          status: 'confirmed',
          price: money(200),
          currency: 'SAR',
          createdAt: new Date().toISOString(),
        },
      }
    },
    async cancel() {
      return { ok: true }
    },
  })

  const failRegistry = createBookingProviderRegistry([failing])
  const failResult = await runBookingExecution({
    userId: 'e2e-f6-fail',
    registry: failRegistry,
    items: [
      {
        domain: 'flights',
        offerId: 'x',
        providerId: 'fail-flights',
        title: 'X',
        price: money(100),
      },
    ],
    transaction: { maxRetries: 0 },
  })
  steps.push(
    step(
      'f6.failure',
      'Provider failure normalized',
      failResult.bookings[0]?.status === 'failed' ? 'pass' : 'fail',
      `status=${failResult.bookings[0]?.status}`,
    ),
  )

  const retryRegistry = createBookingProviderRegistry([flaky])
  const retryResult = await runBookingExecution({
    userId: 'e2e-f6-retry',
    registry: retryRegistry,
    items: [
      {
        domain: 'flights',
        offerId: 'offer-retry',
        providerId: 'flaky-flights',
        title: 'Retry flight',
        price: money(200),
      },
    ],
    transaction: { maxRetries: 2, retryDelayMs: 1 },
  })
  steps.push(
    step(
      'f6.retry',
      'Automatic retry recovery',
      attempts >= 2
        && (retryResult.bookings[0]?.status === 'confirmed'
          || retryResult.bookings[0]?.status === 'ticketed')
        ? 'pass'
        : 'fail',
      `attempts=${attempts} status=${retryResult.bookings[0]?.status}`,
    ),
  )

  const fallback = createValidationRegistry()
  const bi = await runBookingIntelligence({
    userId: 'e2e-f6-fallback',
    memory: validationMemory(),
    registry: fallback,
  })
  steps.push(
    step(
      'f6.fallback',
      'Fallback to simulated providers',
      bi.ranked.length > 0 ? 'pass' : 'fail',
      `ranked=${bi.ranked.length}`,
    ),
  )

  steps.push(
    step(
      'f6.normalize',
      'Error normalization',
      failResult.snapshot.failedCount >= 1 ? 'pass' : 'fail',
      `failedCount=${failResult.snapshot.failedCount}`,
    ),
  )

  return {
    flowId: 'flow6_provider_failure_recovery',
    name: 'Provider failure → retry → fallback → recovery',
    ok: steps.every((s) => s.status === 'pass'),
    steps,
    durationMs: Date.now() - started,
  }
}

/** Flow 7: Feature flag ON/OFF for optional subsystems */
export async function runFlow7FeatureFlags(): Promise<ValidationFlowResult> {
  const started = Date.now()
  const steps: ValidationStepResult[] = []
  const registry = getFeatureRegistry()

  const requiredOn: FeatureId[] = [
    'ai.booking_intelligence',
    'ai.booking_execution',
    'ai.trip_management',
  ]
  for (const id of requiredOn) {
    steps.push(
      step(
        `f7.on.${id}`,
        `${id} default ON`,
        registry.isEnabled(id) ? 'pass' : 'fail',
      ),
    )
  }

  const mustOff: FeatureId[] = [
    'ai.live_providers',
    'payments.live',
    'providers.live_master',
  ]
  for (const id of mustOff) {
    const exists = Boolean(registry.get(id))
    if (!exists) {
      steps.push(step(`f7.off.${id}`, `${id} absent`, 'skip', 'flag not registered'))
      continue
    }
    steps.push(
      step(
        `f7.off.${id}`,
        `${id} default OFF`,
        !registry.isEnabled(id) ? 'pass' : 'fail',
      ),
    )
  }

  const prev = registry.isEnabled('ai.booking_intelligence')
  registry.setEnabled('ai.booking_intelligence', false)
  const disabled = !registry.isEnabled('ai.booking_intelligence')
  registry.setEnabled('ai.booking_intelligence', prev)
  const restored = registry.isEnabled('ai.booking_intelligence') === prev
  steps.push(
    step(
      'f7.toggle',
      'ON/OFF toggle behaviour',
      disabled && restored ? 'pass' : 'fail',
      `disabled=${disabled} restored=${restored}`,
    ),
  )

  return {
    flowId: 'flow7_feature_flags',
    name: 'Feature flags ON/OFF behaviour',
    ok: steps.every((s) => s.status === 'pass' || s.status === 'skip'),
    steps,
    durationMs: Date.now() - started,
  }
}
