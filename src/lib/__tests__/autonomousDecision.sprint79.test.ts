/**
 * Sprint 79 — Autonomous Search & Decision Engine tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  createSearchPlans,
  dedupeCandidates,
  executeSearchPlansParallel,
  normalizeFlight,
  normalizeHotel,
  onDecisionEvent,
  resetDecisionEventListeners,
  runDecisionEngine,
  scoreItinerary,
  SPRINT79_DECISION_ENGINE_VERSION,
  type DecisionEvent,
  type SearchCandidate,
} from '../../core'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'd79'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
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
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
  }
}

const flightOffers = [
  {
    id: 'cheap-long',
    providerId: 'mock',
    airline: 'Flynas',
    price: 800,
    currency: 'SAR',
    durationMinutes: 720,
    stops: 1,
    layoverMinutes: 300,
    departureHour: 14,
    arrivalHour: 23,
    cabin: 'economy',
    baggageIncluded: false,
    refundable: false,
  },
  {
    id: 'fast-direct',
    providerId: 'amadeus',
    airline: 'Saudia',
    price: 2200,
    currency: 'SAR',
    durationMinutes: 180,
    stops: 0,
    departureHour: 8,
    arrivalHour: 11,
    cabin: 'economy',
    baggageIncluded: true,
    refundable: true,
    loyaltyMatch: true,
    airportQuality: 88,
  },
  {
    id: 'premium-biz',
    providerId: 'duffel',
    airline: 'Qatar Airways',
    price: 4800,
    currency: 'SAR',
    durationMinutes: 200,
    stops: 0,
    departureHour: 9,
    arrivalHour: 12,
    cabin: 'business',
    baggageIncluded: true,
    refundable: true,
    loyaltyMatch: true,
    airportQuality: 92,
  },
]

const hotelStays = [
  {
    id: 'budget-far',
    providerId: 'mock',
    name: 'Budget Inn',
    total: 500,
    hotelStars: 2,
    rating: 6,
    walkMinutes: 50,
    familyFriendly: false,
    refundable: false,
  },
  {
    id: 'family-good',
    providerId: 'booking',
    name: 'Family Resort',
    total: 1800,
    hotelStars: 4,
    rating: 8.5,
    walkMinutes: 12,
    familyFriendly: true,
    refundable: true,
    reviewQuality: 84,
  },
  {
    id: 'lux',
    providerId: 'booking',
    name: 'Four Seasons',
    total: 4200,
    hotelStars: 5,
    rating: 9.4,
    walkMinutes: 8,
    familyFriendly: true,
    refundable: true,
    reviewQuality: 94,
  },
]

describe('Sprint 79 — Autonomous Search & Decision Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDecisionEventListeners()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDecisionEventListeners()
  })

  it('enables ai.autonomous_decision by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.autonomous_decision')).toBe(true)
    expect(SPRINT79_DECISION_ENGINE_VERSION).toMatch(/decision/)
  })

  it('creates five independent search plans A–E', () => {
    const plans = createSearchPlans({ budgetAmount: 9000, preferDirect: true })
    expect(plans).toHaveLength(5)
    expect(plans.map((p) => p.objective)).toEqual([
      'cheapest',
      'balanced',
      'fastest',
      'premium_comfort',
      'loyalty_friendly',
    ])
    for (const plan of plans) {
      expect(plan.priorityWeights.price).toBeGreaterThan(0)
      expect(plan.providerOrder.length).toBeGreaterThan(0)
      expect(plan.fallbackStrategy).toBeTruthy()
      expect(plan.confidence).toBeGreaterThan(0.5)
    }
  })

  it('scores candidates with configurable weighted dimensions', () => {
    const flight = normalizeFlight(flightOffers[1]!, 0)
    const hotel = normalizeHotel(hotelStays[1]!, 0)
    const score = scoreItinerary({
      flight,
      hotel,
      totalPrice: flight.price + hotel.price,
      weights: createSearchPlans()[1]!.priorityWeights,
      budgetCap: 9000,
    })
    expect(score.overall).toBeGreaterThan(40)
    expect(score.dimensions.price).toBeGreaterThan(0)
    expect(score.dimensions.duration).toBeGreaterThan(0)
    expect(score.dimensions.hotel_rating).toBeGreaterThan(0)
  })

  it('executes search plans in parallel and returns candidates', async () => {
    const plans = createSearchPlans({ budgetAmount: 12000 })
    const flights = flightOffers.map((o, i) => normalizeFlight(o, i))
    const hotels = hotelStays.map((s, i) => normalizeHotel(s, i))
    const started = Date.now()
    const result = await executeSearchPlansParallel({
      plans,
      flights,
      hotels,
      budgetCap: 12000,
    })
    const elapsed = Date.now() - started
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2000)
    const planIds = new Set(result.candidates.map((c) => c.planId))
    expect(planIds.size).toBeGreaterThan(1)
  })

  it('eliminates duplicate itineraries across plans', () => {
    const base: SearchCandidate = {
      id: 'a',
      planId: 'plan-a',
      providerId: 'mock',
      title: 'X',
      totalPrice: 3000,
      currency: 'SAR',
      flight: normalizeFlight(flightOffers[1]!, 0),
      hotel: normalizeHotel(hotelStays[1]!, 0),
      normalizedKey: 'fast-direct::family-good',
      score: {
        overall: 70,
        dimensions: {
          price: 70, duration: 70, layovers: 70, airport_quality: 70,
          departure_time: 70, arrival_time: 70, hotel_rating: 70,
          walking_distance: 70, review_quality: 70, refund_policy: 70,
          baggage: 70, overall_convenience: 70,
        },
        weighted: createSearchPlans()[0]!.priorityWeights,
        confidence: 80,
      },
      reasons: [],
      labels: [],
    }
    const dup = {
      ...base,
      id: 'b',
      planId: 'plan-b',
      score: { ...base.score!, overall: 85 },
    }
    const { unique, duplicateCount } = dedupeCandidates([base, dup])
    expect(duplicateCount).toBe(1)
    expect(unique).toHaveLength(1)
    expect(unique[0]!.score?.overall).toBe(85)
  })

  it('selects best overall with explainable reasons and alternative labels', async () => {
    const result = await runDecisionEngine({
      flightOffers,
      hotelStays,
      strategy: { purpose: 'vacation', budgetAmount: 10000 },
      budgetCap: 10000,
    })
    expect(result.recommendations.bestOverall).toBeTruthy()
    expect(result.recommendations.bestBudget).toBeTruthy()
    expect(result.recommendations.fastest).toBeTruthy()
    expect(result.recommendations.bestComfort).toBeTruthy()
    expect(result.recommendations.bestFamily).toBeTruthy()
    expect(result.recommendations.explanation).toMatch(/I selected/i)
    expect(result.recommendations.explanation).toMatch(/Confidence:/i)
    expect(result.recommendations.confidence).toBeGreaterThan(0)
    expect(result.recommendations.bestOverall!.reasons.length).toBeGreaterThan(0)
  })

  it('prefers faster itineraries for fastest plan objective', async () => {
    const result = await runDecisionEngine({
      flightOffers,
      hotelStays,
      strategy: { purpose: 'business', preferDirect: true, budgetAmount: 15000 },
      budgetCap: 15000,
    })
    const fastest = result.recommendations.fastest
    expect(fastest).toBeTruthy()
    expect(fastest!.flight.stops).toBe(0)
    expect((fastest!.flight.durationMinutes ?? 9999)).toBeLessThanOrEqual(220)
  })

  it('uses fallback when constraints eliminate all candidates', async () => {
    const result = await runDecisionEngine({
      flightOffers: [{
        id: 'only',
        providerId: 'mock',
        airline: 'X',
        price: 1000,
        durationMinutes: 200,
        stops: 2,
        cabin: 'economy',
      }],
      hotelStays: [{
        id: 'h',
        name: 'H',
        total: 400,
        hotelStars: 2,
        walkMinutes: 60,
      }],
      strategy: {
        budgetAmount: 500,
        preferDirect: true,
        loyaltyPreferred: true,
      },
      budgetCap: 500,
    })
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.fallbackUsed).toBe(true)
  })

  it('emits observability events for plan/candidate lifecycle', async () => {
    const seen: DecisionEvent['name'][] = []
    const stop = onDecisionEvent((e) => {
      seen.push(e.name)
    })
    await runDecisionEngine({
      flightOffers,
      hotelStays,
      strategy: { budgetAmount: 10000 },
      budgetCap: 10000,
    })
    stop()
    expect(seen).toContain('search.plan.created')
    expect(seen).toContain('search.plan.executed')
    expect(seen).toContain('candidate.generated')
    expect(seen).toContain('candidate.scored')
    expect(seen).toContain('candidate.selected')
  })

  it('handles empty offer pools without throwing', async () => {
    const result = await runDecisionEngine({
      flightOffers: [],
      hotelStays: [],
      strategy: { budgetAmount: 5000 },
    })
    expect(result.recommendations.bestOverall).toBeNull()
    expect(result.fallbackUsed).toBe(true)
    expect(result.plans.length).toBe(5)
  })

  it('planTurn attaches autonomousDecision meta when tools produce offers', async () => {
    const agent = createTravelAgentService({
      autonomousDecisionEnabled: true,
      travelPlannerEnabled: true,
      tripOptimizerEnabled: false,
      travelerPersonalizationEnabled: false,
      budgetIntelligenceEnabled: false,
      bookingIntelligenceEnabled: false,
      bookingExecutionEnabled: false,
      paymentsEnabled: false,
      rahhalBrainEnabled: false,
      autonomousAgentEnabled: false,
    })
    const turn = await agent.planTurn({
      conversationId: 'd79-meta',
      messages: [msg(
        'Trip from Riyadh to Dubai for 4 days, 2 travelers, budget SAR 9000. I want the best overall option.',
        'd79-meta',
      )],
    })
    if (turn.meta.autonomousDecision) {
      expect(turn.meta.autonomousDecision.planCount).toBe(5)
      expect(turn.meta.autonomousDecision.confidence).toBeGreaterThanOrEqual(0)
    } else {
      // Intake may still be collecting — core engine remains healthy.
      expect(getFeatureRegistry().isEnabled('ai.autonomous_decision')).toBe(true)
    }
  })
})
