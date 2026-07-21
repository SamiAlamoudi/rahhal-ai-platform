/**
 * Sprint 80 — Adaptive Learning & Personalization Engine tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  analyzeRepeatedBehavior,
  createPreferenceStore,
  createAdaptiveLearningEngine,
  decreaseConfidence,
  emptyTravelerProfile,
  formatLearningExplanation,
  improveRecommendations,
  increaseConfidence,
  inferPreferencesFromText,
  onLearningEvent,
  processFeedback,
  resetLearningEventListeners,
  resetPreferenceStore,
  runAdaptiveLearning,
  runDecisionEngine,
  snapConfidence,
  SPRINT80_ADAPTIVE_LEARNING_VERSION,
  type LearningEvent,
  type SearchCandidate,
  type TravelerProfile,
} from '../../core'
import {
  isAdaptiveLearningEnabled,
  runAdaptiveLearningTurn,
  resetAdaptiveLearningProfile,
  setAdaptiveLearningEnabled,
} from '../agent/adaptiveLearning'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'learn80'): ChatMessage {
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

function baseCandidate(input: {
  id?: string
  airline?: string
  hotelName?: string
  walkMinutes?: number
  overall?: number
}): SearchCandidate {
  const airline = input.airline ?? 'Flynas'
  const hotelName = input.hotelName ?? 'Budget Inn'
  const walkMinutes = input.walkMinutes ?? 40
  const overall = input.overall ?? 60
  const id = input.id ?? `c-${airline}-${hotelName}`
  return {
    id,
    planId: 'plan-b',
    providerId: 'mock',
    title: `${airline} + ${hotelName}`,
    totalPrice: 3000,
    currency: 'SAR',
    normalizedKey: `${airline}::${hotelName}`,
    flight: {
      id: 'f1',
      providerId: 'mock',
      airline,
      price: 1500,
      currency: 'SAR',
      durationMinutes: 200,
      stops: 0,
      layoverMinutes: null,
      departureHour: 9,
      arrivalHour: 12,
      cabin: 'economy',
      baggageIncluded: true,
      refundable: true,
      airportQuality: 80,
      loyaltyMatch: false,
      payload: {},
    },
    hotel: {
      id: 'h1',
      providerId: 'mock',
      name: hotelName,
      price: 1500,
      currency: 'SAR',
      stars: 4,
      rating: 8,
      walkMinutes,
      reviewQuality: 80,
      refundable: true,
      familyFriendly: true,
      payload: { chain: hotelName },
    },
    score: {
      overall,
      confidence: 80,
      weighted: {
        price: 0.2,
        duration: 0.1,
        layovers: 0.1,
        airport_quality: 0.05,
        departure_time: 0.05,
        arrival_time: 0.05,
        hotel_rating: 0.15,
        walking_distance: 0.1,
        review_quality: 0.05,
        refund_policy: 0.05,
        baggage: 0.05,
        overall_convenience: 0.05,
      },
      dimensions: {
        price: 70,
        duration: 70,
        layovers: 80,
        departure_time: 70,
        arrival_time: 70,
        hotel_rating: 75,
        walking_distance: walkMinutes <= 15 ? 90 : 40,
        baggage: 60,
        refund_policy: 50,
        review_quality: 70,
        airport_quality: 70,
        overall_convenience: 65,
      },
    },
    labels: [],
    reasons: [],
  }
}

describe('Sprint 80 — Adaptive Learning & Personalization Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceStore()
    resetLearningEventListeners()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetPreferenceStore()
    resetLearningEventListeners()
  })

  it('enables ai.adaptive_learning by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.adaptive_learning')).toBe(true)
    expect(isAdaptiveLearningEnabled()).toBe(true)
    expect(SPRINT80_ADAPTIVE_LEARNING_VERSION).toMatch(/adaptive-learning/)
  })

  describe('preference inference', () => {
    it('infers airlines, hotels, seat, cabin, walkability from conversation', () => {
      const signals = inferPreferencesFromText(
        'I usually prefer Emirates and Marriott with aisle seats in business class near city center',
      )
      const kinds = new Set(signals.map((s) => s.kind))
      expect(kinds.has('airline')).toBe(true)
      expect(kinds.has('hotel_brand')).toBe(true)
      expect(kinds.has('seat')).toBe(true)
      expect(kinds.has('cabin')).toBe(true)
      expect(kinds.has('walkability')).toBe(true)
      expect(signals.find((s) => s.kind === 'airline')?.value).toBe('emirates')
      expect(signals.find((s) => s.kind === 'seat')?.value).toBe('aisle')
    })

    it('infers avoid luxury / value preference from rejection cues', () => {
      const signals = inferPreferencesFromText('I avoid luxury hotels, prefer value and budget')
      expect(signals.some((s) => s.kind === 'luxury_vs_value' && s.polarity === 'avoid')).toBe(true)
      expect(signals.some((s) => s.kind === 'hotel_budget_style' && s.value === 'value')).toBe(true)
    })

    it('infers family / food / activity / pace patterns', () => {
      const signals = inferPreferencesFromText(
        'Family trip with kids, need halal food, beach activities, relaxed pace',
      )
      expect(signals.some((s) => s.kind === 'family_pattern')).toBe(true)
      expect(signals.some((s) => s.kind === 'food' && s.value === 'halal')).toBe(true)
      expect(signals.some((s) => s.kind === 'activity' && s.value === 'beach')).toBe(true)
      expect(signals.some((s) => s.kind === 'travel_pace' && s.value === 'relaxed')).toBe(true)
    })
  })

  describe('confidence updates', () => {
    it('snaps and ladders confidence levels', () => {
      expect(snapConfidence(0.12)).toBe(0.1)
      expect(snapConfidence(0.5)).toBe(0.4)
      expect(increaseConfidence(0.1)).toBe(0.25)
      expect(increaseConfidence(0.8)).toBe(0.95)
      expect(increaseConfidence(0.95)).toBe(0.95)
      expect(decreaseConfidence(0.4)).toBe(0.25)
      expect(decreaseConfidence(0.1)).toBe(0.1)
    })

    it('increases confidence on repeated same-polarity behavior', () => {
      const store = createPreferenceStore()
      const engine = createAdaptiveLearningEngine(store)
      engine.learn({
        userId: 'u1',
        feedback: { type: 'booking_selection', airline: 'emirates' },
      })
      let profile = engine.getProfile('u1')!
      expect(profile.preferences[0]?.confidence).toBe(0.1)

      engine.learn({
        userId: 'u1',
        feedback: { type: 'booking_selection', airline: 'emirates' },
      })
      profile = engine.getProfile('u1')!
      expect(profile.preferences.find((p) => p.kind === 'airline')?.confidence).toBeGreaterThanOrEqual(0.25)
    })

    it('decreases confidence when opposite behavior appears', () => {
      const engine = createAdaptiveLearningEngine(createPreferenceStore())
      for (let i = 0; i < 3; i += 1) {
        engine.learn({
          userId: 'u2',
          feedback: { type: 'booking_selection', airline: 'emirates' },
        })
      }
      const before = engine.getProfile('u2')!.preferences.find((p) => p.value === 'emirates')!
      expect(before.confidence).toBeGreaterThanOrEqual(0.4)

      engine.learn({
        userId: 'u2',
        feedback: { type: 'rejected_recommendation', airline: 'emirates' },
      })
      const after = engine.getProfile('u2')!.preferences.find((p) => p.value === 'emirates')!
      expect(after.confidence).toBeLessThan(before.confidence)
    })
  })

  describe('feedback + behavior history', () => {
    it('processes booking / reject / expensive feedback', () => {
      const accepted = processFeedback({
        type: 'accepted_recommendation',
        airline: 'Saudia',
        hotelBrand: 'Hilton',
        seat: 'aisle',
        walkMinutes: 10,
      })
      expect(accepted.some((s) => s.kind === 'airline')).toBe(true)
      expect(accepted.some((s) => s.kind === 'walkability')).toBe(true)

      const expensive = processFeedback({
        type: 'rejected_recommendation',
        expensiveRejected: true,
      })
      expect(expensive.some((s) => s.kind === 'luxury_vs_value' && s.polarity === 'avoid')).toBe(true)
    })

    it('records behavior history and detects repeated patterns', () => {
      const result = runAdaptiveLearning({
        userId: 'hist1',
        feedback: [
          { type: 'booking_selection', airline: 'emirates', seat: 'aisle' },
          { type: 'booking_selection', airline: 'emirates', seat: 'aisle' },
        ],
      })
      expect(result.profile.behaviorHistory.length).toBeGreaterThanOrEqual(2)
      const repeated = analyzeRepeatedBehavior(result.profile)
      expect(repeated.some((s) => s.kind === 'airline' && s.value === 'emirates')).toBe(true)
      expect(repeated.some((s) => s.kind === 'seat' && s.value === 'aisle')).toBe(true)
    })
  })

  describe('recommendation adjustment', () => {
    it('boosts preferred airline/hotel and explains why', () => {
      const profile: TravelerProfile = {
        ...emptyTravelerProfile('adj1'),
        preferences: [
          {
            kind: 'airline',
            value: 'emirates',
            polarity: 'prefer',
            confidence: 0.8,
            observations: 4,
            updatedAt: new Date().toISOString(),
            source: 'repeated_behavior',
          },
          {
            kind: 'hotel_brand',
            value: 'marriott',
            polarity: 'prefer',
            confidence: 0.6,
            observations: 3,
            updatedAt: new Date().toISOString(),
            source: 'explicit',
          },
          {
            kind: 'walkability',
            value: 'high',
            polarity: 'prefer',
            confidence: 0.6,
            observations: 3,
            updatedAt: new Date().toISOString(),
            source: 'implicit',
          },
        ],
      }

      const cheap = baseCandidate({
        id: 'cheap',
        airline: 'Flynas',
        hotelName: 'Budget Inn',
        walkMinutes: 50,
        overall: 72,
      })
      const preferred = baseCandidate({
        id: 'pref',
        airline: 'Emirates',
        hotelName: 'Marriott Downtown',
        walkMinutes: 8,
        overall: 68,
      })

      const { candidates, adjustmentReasons, adjusted } = improveRecommendations({
        candidates: [cheap, preferred],
        profile,
      })
      expect(adjusted).toBe(true)
      const prefScore = candidates.find((c) => c.id === 'pref')!.score!.overall
      const cheapScore = candidates.find((c) => c.id === 'cheap')!.score!.overall
      expect(prefScore).toBeGreaterThan(cheapScore)
      expect(adjustmentReasons.some((r) => r.code === 'learned_airline')).toBe(true)
      const expl = formatLearningExplanation(adjustmentReasons)
      expect(expl).toContain('Recommended because:')
      expect(expl).toContain('✓')
    })

    it('Decision Engine consumes learned profile and adjusts ranking', async () => {
      const store = createPreferenceStore()
      const engine = createAdaptiveLearningEngine(store)
      for (let i = 0; i < 4; i += 1) {
        engine.learn({
          userId: 'dec1',
          feedback: {
            type: 'booking_selection',
            airline: 'emirates',
            hotelBrand: 'marriott',
            walkMinutes: 10,
          },
        })
      }
      const profile = engine.getProfile('dec1')!

      const result = await runDecisionEngine({
        flightOffers: [
          {
            id: 'other',
            airline: 'Flynas',
            price: 900,
            currency: 'SAR',
            durationMinutes: 300,
            stops: 1,
            cabin: 'economy',
          },
          {
            id: 'ek',
            airline: 'Emirates',
            price: 1600,
            currency: 'SAR',
            durationMinutes: 220,
            stops: 0,
            cabin: 'economy',
            baggageIncluded: true,
          },
        ],
        hotelStays: [
          {
            id: 'far',
            name: 'Budget Inn',
            total: 600,
            hotelStars: 2,
            walkMinutes: 45,
          },
          {
            id: 'mar',
            name: 'Marriott City Center',
            total: 1400,
            hotelStars: 4,
            walkMinutes: 10,
            familyFriendly: true,
            chain: 'marriott',
          },
        ],
        budgetCap: 8000,
        learnedProfile: profile,
      })

      expect(result.recommendations.bestOverall).toBeTruthy()
      expect(result.recommendations.explanation).toMatch(/Recommended because:|I selected/)
      const bestAirline = result.recommendations.bestOverall!.flight.airline.toLowerCase()
      const bestHotel = result.recommendations.bestOverall!.hotel.name.toLowerCase()
      expect(bestAirline.includes('emirates') || bestHotel.includes('marriott')).toBe(true)
    })
  })

  describe('privacy', () => {
    it('supports reset profile', () => {
      const engine = createAdaptiveLearningEngine()
      engine.learn({
        userId: 'priv1',
        userText: 'I prefer Emirates and aisle seats',
      })
      expect(engine.getProfile('priv1')?.preferences.length).toBeGreaterThan(0)
      engine.resetProfile('priv1')
      expect(engine.getProfile('priv1')).toBeNull()
      resetAdaptiveLearningProfile('priv1')
      expect(getFeatureRegistry().isEnabled('ai.adaptive_learning')).toBe(true)
    })

    it('no-ops learning when disabled', () => {
      setAdaptiveLearningEnabled('off1', false)
      const result = runAdaptiveLearning({
        userId: 'off1',
        userText: 'I always book Emirates business class aisle seats',
      })
      expect(result.inferred).toHaveLength(0)
      expect(result.session.learningEnabled).toBe(false)
      expect(result.profile.preferences).toHaveLength(0)
    })

    it('feature flag disable skips agent turn learning', () => {
      expect(runAdaptiveLearningTurn({
        userId: 'flag1',
        userText: 'prefer Hilton',
        enabled: false,
      })).toBeNull()
    })
  })

  describe('observability', () => {
    it('emits learning lifecycle events', () => {
      const seen: LearningEvent['name'][] = []
      onLearningEvent((e) => seen.push(e.name))
      runAdaptiveLearning({
        userId: 'ev1',
        userText: 'I prefer Qatar Airways and city center hotels',
      })
      expect(seen).toContain('learning.started')
      expect(seen).toContain('preference.inferred')
      expect(seen).toContain('profile.updated')
      expect(seen).toContain('learning.completed')
    })
  })

  describe('edge cases', () => {
    it('handles empty text and missing userId', () => {
      expect(inferPreferencesFromText('')).toEqual([])
      expect(inferPreferencesFromText(null)).toEqual([])
      expect(runAdaptiveLearningTurn({ userId: '', userText: 'x' })).toBeNull()
      const emptyImprove = improveRecommendations({
        candidates: [],
        profile: emptyTravelerProfile('e'),
      })
      expect(emptyImprove.adjusted).toBe(false)
    })

    it('agent turn attaches adaptiveLearning meta', async () => {
      const agent = createTravelAgentService({
        adaptiveLearningEnabled: true,
        autonomousDecisionEnabled: false,
        bookingIntelligenceEnabled: false,
        bookingExecutionEnabled: false,
        paymentsEnabled: false,
        rahhalBrainEnabled: false,
        autonomousAgentEnabled: false,
      })
      const turn = await agent.planTurn({
        conversationId: 'agent-learn-80',
        messages: [msg(
          'I usually prefer Emirates and Marriott with aisle seats',
          'agent-learn-80',
        )],
      })
      expect(turn.meta.adaptiveLearning).toBeTruthy()
      expect(turn.meta.adaptiveLearning!.preferenceCount).toBeGreaterThan(0)
      expect(turn.meta.adaptiveLearning!.learningEnabled).toBe(true)
    })
  })
})
