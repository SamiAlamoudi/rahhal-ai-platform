/**
 * Sprint 25 — Production Booking Flow (MVP) tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  createEmptyMemory,
  resetBrainIntegrationSessions,
} from '../brain'
import {
  getBookingOrchestrator,
  resetBookingOrchestrator,
  toBookingSelectedItem,
  type BookingSelectedItem,
} from '../booking'
import {
  BookingFlowController,
  clearBookingFlowStatesForUser,
  detectBookingFlowConversationEdit,
  isBookingFlowEnabled,
  resetBookingFlowController,
  searchOptionToBookingSelectedItem,
  searchOptionsToBookingSelectedItems,
} from '../bookingFlow'
import type { FlightOption, HotelOption } from '../brain/search'
import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'

function userMessage(content: string, conversationId = 'c-s25'): ChatMessage {
  const now = '2026-07-19T00:00:00.000Z'
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

function normalizedFlight(id: string, price = 1200): NormalizedTravelOption {
  return {
    id,
    type: 'flight',
    title: `Saudia RUH→DXB ${id}`,
    providerIds: ['mock-flight'],
    price,
    currency: 'SAR',
    durationMinutes: 150,
    stops: 0,
    rating: null,
    location: null,
    baggageIncluded: true,
    familyFriendly: null,
    refundable: true,
    attributes: { bookingKind: 'flight', airline: 'Saudia' },
    decisionScore: null,
    recommendationLevel: null,
    reasons: [],
  }
}

function normalizedHotel(id: string, price = 500): NormalizedTravelOption {
  return {
    id,
    type: 'hotel',
    title: `Marina Resort ${id}`,
    providerIds: ['mock-hotel'],
    price,
    currency: 'SAR',
    durationMinutes: null,
    stops: null,
    rating: 5,
    location: 'Marina',
    baggageIncluded: null,
    familyFriendly: null,
    refundable: true,
    attributes: { bookingKind: 'hotel', area: 'Marina' },
    decisionScore: null,
    recommendationLevel: null,
    reasons: [],
  }
}

describe('Sprint 25 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers ui.booking_flow disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ui.booking_flow')).toBe(false)
    expect(isBookingFlowEnabled()).toBe(false)
  })

  it('requires ui.passenger_booking_flow before ui.booking_flow', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('ui.booking_flow', true)
    // passenger_booking_flow is ON by default, so enabling booking_flow should work
    expect(registry.isEnabled('ui.passenger_booking_flow')).toBe(true)
    expect(registry.isEnabled('ui.booking_flow')).toBe(true)
    expect(isBookingFlowEnabled()).toBe(true)

    registry.setEnabled('ui.passenger_booking_flow', false)
    expect(registry.isEnabled('ui.booking_flow')).toBe(false)
  })
})

describe('Sprint 25 BookingFlowController', () => {
  const prefix = 'test_bflow_s25:'

  beforeEach(() => {
    resetBookingOrchestrator()
    resetBookingFlowController()
    clearBookingFlowStatesForUser('user-s25', prefix)
  })
  afterEach(() => {
    resetBookingOrchestrator()
    resetBookingFlowController()
    clearBookingFlowStatesForUser('user-s25', prefix)
  })

  it('runs selection → session → review → ready for payment', async () => {
    const controller = BookingFlowController({ storagePrefix: prefix })
    const flow = controller.createFlow({
      userId: 'user-s25',
      conversationId: 'c-s25',
      currency: 'SAR',
      budget: { amount: 10000, currency: 'SAR' },
      dates: { startDate: '2026-10-01', endDate: '2026-10-07', durationDays: 6 },
      travelers: { adults: 2, children: 0, infants: 0, summary: '2 adults' },
    })

    controller.setStage(flow.id, 'planning')
    controller.setStage(flow.id, 'execution')
    controller.setStage(flow.id, 'search_results')

    const items: BookingSelectedItem[] = [
      toBookingSelectedItem(normalizedFlight('fl1')),
      toBookingSelectedItem(normalizedHotel('ht1')),
    ]
    const applied = await controller.applySelection({ flowId: flow.id, items })
    expect(applied.session.items.length).toBe(2)
    expect(applied.flow.stage).toBe('booking_session')

    const { model } = await controller.enterReview(flow.id)
    expect(model.sections.some((s) => s.id === 'flights')).toBe(true)
    expect(model.sections.some((s) => s.id === 'hotels')).toBe(true)
    expect(model.sections.some((s) => s.id === 'price_summary')).toBe(true)
    expect(model.sections.some((s) => s.id === 'budget_comparison')).toBe(true)
    expect(model.budgetComparison.withinBudget).toBe(true)
    expect(model.travelers.adults).toBe(2)
    expect(model.dates.durationDays).toBe(6)

    const payment = await controller.markReadyForPayment(flow.id)
    expect(payment.flow.stage).toBe('ready_for_payment')
    expect(payment.nav.path).toBe('/checkout')
    expect(payment.nav.state.bookingSessionId).toBe(applied.session.id)
  })

  it('replaces hotel without recreating flights', async () => {
    const controller = BookingFlowController({ storagePrefix: prefix })
    const flow = controller.createFlow({ userId: 'user-s25', currency: 'SAR' })
    await controller.applySelection({
      flowId: flow.id,
      items: [
        toBookingSelectedItem(normalizedFlight('fl-keep')),
        toBookingSelectedItem(normalizedHotel('ht-old', 800)),
      ],
    })

    const replaced = await controller.replaceSection(flow.id, 'hotels', [
      toBookingSelectedItem(normalizedHotel('ht-new', 400)),
    ])
    const flights = replaced.session.items.filter((i) => i.type === 'flight')
    const hotels = replaced.session.items.filter((i) => i.type === 'hotel')
    expect(flights).toHaveLength(1)
    expect(flights[0]?.providerOfferId).toBe('fl-keep')
    expect(hotels).toHaveLength(1)
    expect(hotels[0]?.providerOfferId).toBe('ht-new')
    expect(replaced.flow.lastEditedSection).toBe('hotels')
  })

  it('restores flow state after simulated refresh', async () => {
    const controller = BookingFlowController({ storagePrefix: prefix })
    const flow = controller.createFlow({
      userId: 'user-s25',
      conversationId: 'c-restore',
      currency: 'SAR',
    })
    const applied = await controller.applySelection({
      flowId: flow.id,
      items: [toBookingSelectedItem(normalizedFlight('fl-r'))],
    })

    // New controller instance = refresh
    const restoredController = BookingFlowController({ storagePrefix: prefix })
    const restored = restoredController.restoreFlow('user-s25', flow.id)
    expect(restored).toBeTruthy()
    expect(restored?.bookingSessionId).toBe(applied.session.id)
    expect(restored?.conversationId).toBe('c-restore')

    // Session still loadable via orchestrator persistence path (in-memory import)
    getBookingOrchestrator().importSession(applied.session)
    const bySession = restoredController.restoreByBookingSession(
      'user-s25',
      applied.session.id,
    )
    expect(bySession?.id).toBe(flow.id)
  })

  it('maps search options into booking selections', () => {
    const flight: FlightOption = {
      id: 'sf1',
      kind: 'flight',
      from: 'RUH',
      to: 'DXB',
      airline: 'Saudia',
      cabin: 'economy',
      price: 1000,
      currency: 'SAR',
      stops: 0,
      durationHours: 2.5,
      providerId: 'mock_flights',
      sourceTaskId: 't1',
    }
    const hotel: HotelOption = {
      id: 'sh1',
      kind: 'hotel',
      name: 'Resort',
      area: 'Downtown',
      stars: 4,
      nightly: 450,
      currency: 'SAR',
      providerId: 'mock_hotels',
      sourceTaskId: 't2',
    }
    const selected = searchOptionsToBookingSelectedItems([flight, hotel])
    expect(selected).toHaveLength(2)
    expect(selected[0]?.bookingType).toBe('flight')
    expect(selected[1]?.bookingType).toBe('hotel')
    expect(searchOptionToBookingSelectedItem(flight).option.title).toMatch(/Saudia/)
  })

  it('detects conversation edits without restarting planning', () => {
    expect(detectBookingFlowConversationEdit('Choose a cheaper hotel.').kind).toBe(
      'cheaper_hotel',
    )
    expect(detectBookingFlowConversationEdit('Use business class.').kind).toBe(
      'business_class',
    )
    expect(detectBookingFlowConversationEdit('Stay two extra nights.').kind).toBe(
      'extend_nights',
    )

    const controller = BookingFlowController({ storagePrefix: prefix })
    const flow = controller.createFlow({
      userId: 'user-s25',
      dates: { startDate: null, endDate: null, durationDays: 5 },
    })
    const edited = controller.applyConversationEdit(flow.id, 'Stay two extra nights.')
    expect(edited.edit.kind).toBe('extend_nights')
    expect(edited.flow.dates.durationDays).toBe(7)
    expect(edited.flow.lastEditedSection).toBe('dates')
  })

  it('syncs booking context into brain memory after changes', async () => {
    const controller = BookingFlowController({ storagePrefix: prefix })
    const flow = controller.createFlow({
      userId: 'user-s25',
      currency: 'SAR',
      budget: { amount: 9000, currency: 'SAR' },
      travelers: { adults: 2, children: 1, infants: 0, summary: '2+1' },
    })
    await controller.applySelection({
      flowId: flow.id,
      items: [toBookingSelectedItem(normalizedFlight('fl-brain'))],
    })
    const memory = createEmptyMemory('c-brain')
    const synced = controller.syncBrain(flow.id, memory)
    expect(synced.memory.budget.amount).toBe(9000)
    expect(synced.memory.travelers.adults).toBe(2)
    expect(synced.summary).toMatch(/stage:/)
  })
})

describe('Sprint 25 backward compatibility', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetBookingFlowController()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetBookingFlowController()
  })

  it('does not change planTurn when booking flow flag is off', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: false,
      bookingFlowEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'c-compat',
      messages: [userMessage('Plan a trip to Dubai', 'c-compat')],
    })
    expect(result.meta.brain).toBeUndefined()
    expect(result.reply).toBeTruthy()
  })

  it('applies conversation booking edits when flow + brain search are on', async () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('ui.booking_flow', true)
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    registry.setEnabled('brain.travel_engine', true)
    registry.setEnabled('brain.trip_planning', true)
    registry.setEnabled('brain.execution', true)
    registry.setEnabled('brain.search', true)

    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: true,
      brainTravelEngineEnabled: true,
      brainTripPlanningEnabled: true,
      brainExecutionEnabled: true,
      brainSearchEnabled: true,
      bookingFlowEnabled: true,
    })

    const result = await service.planTurn({
      conversationId: 'c-flow-edit',
      messages: [userMessage('Choose a cheaper hotel.', 'c-flow-edit')],
    })
    // Should not throw; brain meta present when flags on
    expect(result.meta.brain).toBeTruthy()
  })
})
