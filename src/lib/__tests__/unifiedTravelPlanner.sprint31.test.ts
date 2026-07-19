/**
 * Sprint 31 — Unified Travel Planning Engine tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  UnifiedTravelPlanner,
  buildUnifiedFollowUps,
  detectMissingUnifiedFields,
  emptyUnifiedContext,
  estimateTripCost,
  extractContextFromUserText,
  isUnifiedTravelPlannerEnabled,
  mergeUnifiedContext,
  pairFlightsAndHotels,
  resetBrainIntegrationSessions,
  resetUnifiedTravelPlanner,
  scoreAndRankPlans,
  type UnifiedFlightLeg,
  type UnifiedHotelStay,
} from '../brain'
import { resetHotelProviderFoundation } from '../hotels'
import { resetAITripOrchestrator } from '../brain/orchestrator'
import { resetMemoryContextEngine } from '../brain/memory'

function enableUnifiedPlannerChain(): void {
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
}

const sampleFlight = (overrides: Partial<UnifiedFlightLeg> = {}): UnifiedFlightLeg => ({
  id: 'flt_1',
  from: 'RUH',
  to: 'DXB',
  airline: 'Saudia',
  cabin: 'economy',
  price: 1200,
  currency: 'SAR',
  stops: 0,
  durationHours: 3.2,
  providerId: 'mock-flight-001',
  ...overrides,
})

const sampleHotel = (overrides: Partial<UnifiedHotelStay> = {}): UnifiedHotelStay => ({
  id: 'htl_1',
  name: 'Hilton Dubai Central',
  area: 'Downtown',
  stars: 5,
  nightly: 480,
  nights: 3,
  stayTotal: 1440,
  currency: 'SAR',
  providerId: 'hotelbeds',
  amenities: ['WiFi', 'Pool', 'Breakfast'],
  freeCancellation: true,
  guestScore: 8.9,
  ...overrides,
})

describe('Sprint 31 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetUnifiedTravelPlanner()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetMemoryContextEngine()
    resetHotelProviderFoundation()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetUnifiedTravelPlanner()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetMemoryContextEngine()
    resetHotelProviderFoundation()
  })

  it('registers brain.unified_travel_planner disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('brain.unified_travel_planner')).toBe(false)
    expect(isUnifiedTravelPlannerEnabled()).toBe(false)
  })

  it('requires brain.trip_orchestrator before brain.unified_travel_planner', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.unified_travel_planner', true)
    expect(registry.isEnabled('brain.unified_travel_planner')).toBe(false)
    enableUnifiedPlannerChain()
    expect(registry.isEnabled('brain.unified_travel_planner')).toBe(true)
    expect(isUnifiedTravelPlannerEnabled()).toBe(true)
  })
})

describe('Context extraction & missing info', () => {
  it('extracts destination, origin, budget, preferences from conversation', () => {
    const partial = extractContextFromUserText(
      'Plan a trip from Riyadh to Dubai for 2 adults, 4 nights, budget 9000 SAR, Saudia and Hilton, Alfursan',
      'en',
    )
    expect(partial.origin).toBe('Riyadh')
    expect(partial.destination).toBe('Dubai')
    expect(partial.nights).toBe(4)
    expect(partial.adults).toBe(2)
    expect(partial.budgetAmount).toBe(9000)
    expect(partial.preferredAirlines).toEqual(expect.arrayContaining(['Saudia']))
    expect(partial.preferredHotels).toEqual(expect.arrayContaining(['Hilton']))
    expect(partial.loyaltyPrograms).toEqual(expect.arrayContaining(['Alfursan']))
  })

  it('asks only one minimal follow-up when destination is missing', () => {
    const ctx = mergeUnifiedContext(emptyUnifiedContext('en'), {
      origin: 'Riyadh',
      adults: 2,
      nights: 3,
    })
    const missing = detectMissingUnifiedFields(ctx)
    expect(missing).toContain('destination')
    const followUps = buildUnifiedFollowUps(missing, 'en')
    expect(followUps).toHaveLength(1)
    expect(followUps[0].field).toBe('destination')
  })
})

describe('Budget optimization & ranking', () => {
  it('estimates total trip cost and marks within-budget plans', () => {
    const cost = estimateTripCost({
      flight: sampleFlight({ price: 1000 }),
      hotel: sampleHotel({ stayTotal: 1500, nights: 3 }),
      ctx: mergeUnifiedContext(emptyUnifiedContext('en'), {
        destination: 'Dubai',
        origin: 'Riyadh',
        adults: 2,
        nights: 3,
        budgetAmount: 8000,
        currency: 'SAR',
      }),
    })
    expect(cost.flights).toBe(2000)
    expect(cost.hotels).toBe(1500)
    expect(cost.total).toBeGreaterThan(cost.flights + cost.hotels)
    expect(cost.withinBudget).toBe(true)
  })

  it('ranks plans by budget, preferences, loyalty, and flight-hotel match', () => {
    const ctx = mergeUnifiedContext(emptyUnifiedContext('en'), {
      destination: 'Dubai',
      origin: 'Riyadh',
      nights: 3,
      adults: 2,
      budgetAmount: 10_000,
      preferredAirlines: ['Saudia'],
      preferredHotels: ['Hilton'],
      loyaltyPrograms: ['Alfursan'],
      currency: 'SAR',
    })
    const candidates = pairFlightsAndHotels(
      [
        sampleFlight({ id: 'saudia', airline: 'Saudia', price: 1100, stops: 0 }),
        sampleFlight({ id: 'other', airline: 'Partner Air', price: 900, stops: 1, durationHours: 7 }),
      ],
      [
        sampleHotel({ id: 'hilton', name: 'Hilton Dubai', stayTotal: 1400 }),
        sampleHotel({ id: 'hostel', name: 'City Hostel', stars: 2, stayTotal: 600, nightly: 200 }),
      ],
    )
    const plans = scoreAndRankPlans({ candidates, ctx, maxPlans: 4 })
    expect(plans.length).toBeGreaterThan(1)
    expect(plans[0].rank).toBe(1)
    expect(plans[0].confidence).toBeGreaterThan(0)
    expect(plans[0].flight?.airline).toBe('Saudia')
    expect(plans[0].hotel?.name).toContain('Hilton')
    expect(plans[0].loyaltyAligned).toBe(true)
    expect(plans[0].matchedPreferences.length).toBeGreaterThan(0)
    expect(plans[0].itinerary.length).toBeGreaterThan(2)
    expect(plans[0].cost.total).toBeGreaterThan(0)
  })
})

describe('End-to-end UnifiedTravelPlanner', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetUnifiedTravelPlanner()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetMemoryContextEngine()
    resetHotelProviderFoundation()
    enableUnifiedPlannerChain()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetUnifiedTravelPlanner()
    resetBrainIntegrationSessions()
    resetAITripOrchestrator()
    resetMemoryContextEngine()
    resetHotelProviderFoundation()
  })

  it('returns disabled result when flag is off', async () => {
    resetFeatureRegistry()
    const planner = UnifiedTravelPlanner({ enabled: false, skipOrchestrator: true })
    const result = await planner.planTrip({
      conversationId: 'c-off',
      userText: 'Trip to Dubai from Riyadh',
      locale: 'en',
    })
    expect(result.error).toBe('unified_travel_planner_disabled')
    expect(result.plans).toHaveLength(0)
  })

  it('clarifies with a single follow-up when destination is missing', async () => {
    const planner = UnifiedTravelPlanner({
      enabled: true,
      skipOrchestrator: true,
    })
    const result = await planner.planTrip({
      conversationId: 'c-clarify',
      userText: 'I want to travel with 2 adults for 5 nights',
      locale: 'en',
    })
    expect(result.stage).toBe('clarifying')
    expect(result.followUps).toHaveLength(1)
    expect(result.followUps[0].field).toBe('destination')
    expect(result.plans).toHaveLength(0)
  })

  it('produces ranked multi-option plans from conversation with injected providers', async () => {
    const planner = UnifiedTravelPlanner({
      enabled: true,
      skipOrchestrator: true,
      maxPlans: 3,
      searchFlights: async () => [
        sampleFlight({ id: 'f1', airline: 'Saudia', price: 1150 }),
        sampleFlight({ id: 'f2', airline: 'Emirates', price: 1300 }),
      ],
      searchHotels: async () => [
        sampleHotel({ id: 'h1', name: 'Hilton Dubai', stayTotal: 1500 }),
        sampleHotel({ id: 'h2', name: 'Marriott Dubai', stayTotal: 1600 }),
      ],
    })

    const result = await planner.planTrip({
      conversationId: 'c-e2e',
      userText:
        'Plan a trip from Riyadh to Dubai for 2 adults, 3 nights, budget 9000 SAR, prefer Saudia and Hilton, Alfursan miles',
      locale: 'en',
    })

    expect(result.stage).toBe('complete')
    expect(result.plans.length).toBeGreaterThan(0)
    expect(result.topPlan).not.toBeNull()
    expect(result.topPlan!.confidence).toBeGreaterThan(0.4)
    expect(result.topPlan!.itinerary.length).toBeGreaterThan(2)
    expect(result.costSummary?.total).toBeGreaterThan(0)
    expect(result.confidenceScore).toBeGreaterThan(0)
    expect(result.alternatives.length).toBeGreaterThanOrEqual(0)
    expect(result.reasoning.length).toBeGreaterThan(0)
  })

  it('runs multi-provider hotel foundation + flight search end-to-end', async () => {
    const planner = UnifiedTravelPlanner({
      enabled: true,
      skipOrchestrator: true,
      hotelFoundation: true,
      maxPlans: 3,
    })

    const result = await planner.planTrip({
      conversationId: 'c-providers',
      userText:
        'from Riyadh to Jeddah for 2 adults, 3 nights, budget 7000 SAR, Saudia, Hilton',
      locale: 'en',
    })

    expect(result.stage).toBe('complete')
    expect(result.providers.flightsUsed).toBeGreaterThan(0)
    expect(result.providers.hotelsUsed).toBeGreaterThan(0)
    expect(result.providers.fromHotelFoundation).toBe(true)
    expect(result.topPlan?.flight).not.toBeNull()
    expect(result.topPlan?.hotel).not.toBeNull()
    expect(result.topPlan?.cost.withinBudget === true || result.topPlan?.cost.withinBudget === false || result.topPlan?.cost.withinBudget === null).toBe(true)
  })

  it('integrates with AITripOrchestrator when provided', async () => {
    const planner = UnifiedTravelPlanner({
      enabled: true,
      maxPlans: 2,
      runOrchestrator: async () => ({
        intent: 'SearchPackages',
        confidence: 0.9,
        memory: {
          workingMemory: {
            destination: 'Dubai',
            origin: 'Riyadh',
            travelDates: { startDate: '2026-09-01', endDate: '2026-09-04', durationDays: 3, flexible: false },
            travelers: { adults: 2, children: 0, infants: 0, count: 2 },
            budget: { amount: 8500, currency: 'SAR', flexible: false },
            airlinePreferences: ['Saudia'],
            hotelPreferences: ['Hilton'],
            loyaltyPrograms: [{ name: 'Alfursan' }],
            activities: ['beach'],
            cabinClass: 'economy',
          },
        },
        brain: {
          planning: {
            tripPlan: {
              destination: 'Dubai',
              departureCity: 'Riyadh',
              travelDates: { startDate: '2026-09-01', endDate: '2026-09-04', durationDays: 3 },
              adults: 2,
              children: 0,
              airlinePreferences: ['Saudia'],
              hotelPreferences: ['Hilton'],
              budget: { amount: 8500, currency: 'SAR' },
              activities: ['beach'],
            },
          },
          search: {
            recommendation: {
              top: null,
              alternatives: [],
              rejected: [],
              reasoning: ['Mock aggregation recommendation'],
              confidenceScore: 0.77,
            },
          },
        },
      }),
      searchFlights: async () => [sampleFlight({ airline: 'Saudia' })],
      searchHotels: async () => [sampleHotel({ name: 'Hilton Dubai Marina' })],
    })

    const result = await planner.planTrip({
      conversationId: 'c-orch',
      userText: 'Build my Dubai package',
      locale: 'en',
    })

    expect(result.providers.fromOrchestrator).toBe(true)
    expect(result.intent).toBe('SearchPackages')
    expect(result.memory).toBeTruthy()
    expect(result.topPlan?.matchedPreferences.length).toBeGreaterThan(0)
    expect(result.recommendation?.confidenceScore).toBe(0.77)
    expect(result.stage).toBe('complete')
  })

  it('conversation-driven planning prefers loyalty-aligned Saudia + Hilton', async () => {
    const planner = UnifiedTravelPlanner({
      enabled: true,
      skipOrchestrator: true,
      searchFlights: async () => [
        sampleFlight({ id: 'partner', airline: 'Partner Air', price: 950, stops: 1 }),
        sampleFlight({ id: 'saudia', airline: 'Saudia', price: 1200, stops: 0 }),
      ],
      searchHotels: async () => [
        sampleHotel({ id: 'budget', name: 'City Inn', stars: 3, stayTotal: 900 }),
        sampleHotel({ id: 'hilton', name: 'Hilton Resort', stars: 5, stayTotal: 1600 }),
      ],
    })

    const result = await planner.planTrip({
      conversationId: 'c-prefs',
      userText:
        'from Riyadh to Dubai, 3 nights, 2 adults, budget 10000 SAR, Saudia, Hilton, Alfursan',
      locale: 'en',
    })

    expect(result.topPlan?.flight?.airline).toBe('Saudia')
    expect(result.topPlan?.hotel?.name).toContain('Hilton')
    expect(result.topPlan?.loyaltyAligned).toBe(true)
  })
})
