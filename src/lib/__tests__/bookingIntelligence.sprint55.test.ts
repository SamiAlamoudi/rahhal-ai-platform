import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assessBookingReadiness,
  buildRecommendationConfidence,
  createBookingProviderRegistry,
  createDefaultSimulatedBookingProviders,
  createSimulatedFlightProviders,
  createSimulatedHotelProviders,
  emptyBookingPreferences,
  explainRecommendations,
  fuseOffers,
  getBookingPreferences,
  isBookingIntelligenceEnabled,
  learnBookingPreferences,
  rankOffersV2,
  recordBookingSelection,
  resetBookingPreferences,
  resetDefaultBookingProviderRegistry,
  runBookingIntelligence,
  saveBookingPreferences,
} from '../agent/bookingIntelligence'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory, emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'

function user(content: string, conversationId = 'c-55'): ChatMessage {
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
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  }
}

describe('Sprint 55 — Real Booking Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBookingPreferences()
    resetDefaultBookingProviderRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBookingPreferences()
  })

  describe('feature flag', () => {
    it('registers ai.booking_intelligence enabled by default', () => {
      expect(getFeatureRegistry().isEnabled('ai.booking_intelligence')).toBe(true)
      expect(isBookingIntelligenceEnabled()).toBe(true)
      expect(isBookingIntelligenceEnabled({ enabled: false })).toBe(false)
    })
  })

  describe('provider registry routing', () => {
    it('routes domains without exposing implementations to the caller', async () => {
      const registry = createBookingProviderRegistry(createDefaultSimulatedBookingProviders())
      expect(registry.listDomains()).toEqual([
        'flights',
        'hotels',
        'activities',
        'car_rental',
        'airport_transfer',
        'insurance',
        'visa',
      ])
      const flights = registry.route('flights')
      expect(flights.length).toBeGreaterThan(1)
      expect(flights.every((p) => p.domain === 'flights')).toBe(true)

      const offers = await flights[0]!.search({
        domain: 'flights',
        origin: 'RUH',
        destination: 'Tokyo',
        startDate: '2026-08-01',
        travelers: 2,
        budgetCurrency: 'SAR',
      })
      expect(offers.length).toBeGreaterThan(0)
      expect(offers[0]?.providerId).toBe(flights[0]!.providerId)

      const details = await flights[0]!.details(offers[0]!.id)
      expect(details?.id).toBe(offers[0]!.id)
      const availability = await flights[0]!.availability(offers[0]!.id)
      expect(availability.available).toBe(true)
      const price = await flights[0]!.price(offers[0]!.id)
      expect(price?.amount).toBeGreaterThan(0)
      const booked = await flights[0]!.book(offers[0]!.id)
      expect(booked.ok).toBe(true)
      expect(booked.confirmationId).toBeTruthy()
      const cancelled = await flights[0]!.cancel(booked.confirmationId!)
      expect(cancelled.ok).toBe(true)
    })
  })

  describe('result fusion', () => {
    it('merges, deduplicates, and normalizes currencies', async () => {
      const registry = createBookingProviderRegistry([
        ...createSimulatedFlightProviders(),
        ...createSimulatedHotelProviders(),
      ])
      const all = []
      for (const provider of registry.list()) {
        all.push(...await provider.search({
          domain: provider.domain,
          destination: 'Tokyo',
          origin: 'RUH',
          budgetCurrency: 'USD',
          travelers: 2,
        }))
      }
      expect(all.length).toBeGreaterThan(4)
      const fused = fuseOffers({ offers: all, targetCurrency: 'SAR' })
      expect(fused.length).toBeLessThan(all.length)
      expect(fused.every((o) => o.price.normalizedCurrency === 'SAR')).toBe(true)
      expect(fused.every((o) => o.confidence > 0 && o.qualityScore > 0)).toBe(true)
      expect(fused.some((o) => o.fusedFromProviderIds.length > 1)).toBe(true)
    })
  })

  describe('ranking engine v2', () => {
    it('never sorts by price alone', async () => {
      const registry = createBookingProviderRegistry(createSimulatedHotelProviders())
      const offers = []
      for (const provider of registry.route('hotels')) {
        offers.push(...await provider.search({
          domain: 'hotels',
          destination: 'Tokyo',
          budgetCurrency: 'SAR',
        }))
      }
      const fused = fuseOffers({ offers, targetCurrency: 'SAR' })
      const prefs = emptyBookingPreferences('user-55')
      prefs.hotelStarsMin = 5
      prefs.persona = 'luxury'
      prefs.maxWalkingDistanceMeters = 500
      const ranked = rankOffersV2({
        offers: fused,
        preferences: prefs,
        budgetAmount: 20000,
      })
      expect(ranked.length).toBeGreaterThan(1)
      const cheapest = [...ranked].sort(
        (a, b) => (a.price.normalizedAmount ?? a.price.amount) - (b.price.normalizedAmount ?? b.price.amount),
      )[0]!
      // Top pick is not required to be cheapest — luxury/location should win.
      expect(ranked[0]!.id === cheapest.id).toBe(false)
      expect(ranked[0]!.rankFactors.price).toBeLessThan(1)
      expect(Object.keys(ranked[0]!.rankFactors).length).toBeGreaterThanOrEqual(8)
    })
  })

  describe('personal preference engine', () => {
    it('persists preferences and influences later ranking', async () => {
      const learned = learnBookingPreferences({
        userId: 'pref-55',
        requirements: {
          ...emptyRequirements(),
          budgetStyle: 'luxury',
          travelerType: 'business',
          hotelPreference: 'central',
          interests: ['food'],
          origin: 'RUH',
        },
        preferredAirlines: ['Saudia'],
      })
      expect(learned.budgetStyle).toBe('luxury')
      expect(learned.persona).toBe('business')
      expect(learned.preferredAirlines).toContain('Saudia')
      expect(learned.hotelStarsMin).toBe(5)
      expect(learned.maxWalkingDistanceMeters).toBeLessThanOrEqual(900)

      recordBookingSelection({
        userId: 'pref-55',
        offerId: 'sim-flights-atlas:flights:0',
        providerId: 'sim-flights-atlas',
      })
      const stored = getBookingPreferences('pref-55')
      expect(stored.pastSelectedOfferIds).toContain('sim-flights-atlas:flights:0')
      expect(stored.pastSelectedProviderIds).toContain('sim-flights-atlas')

      saveBookingPreferences({
        ...stored,
        preferredHotelChains: ['Harbor'],
      })
      expect(getBookingPreferences('pref-55').preferredHotelChains).toContain('Harbor')
    })
  })

  describe('cost optimizer', () => {
    it('compares split, package, and mixed combinations', async () => {
      const result = await runBookingIntelligence({
        userId: 'cost-55',
        memory: {
          ...emptyMemory('en'),
          requirements: {
            ...emptyRequirements(),
            destination: 'Tokyo',
            destinations: ['Tokyo'],
            origin: 'RUH',
            startDate: '2026-08-10',
            durationDays: 5,
            travelers: 2,
            budgetAmount: 12000,
            budgetCurrency: 'SAR',
            packageScope: 'full_package',
          },
          missingFields: [],
        },
      })
      expect(result.combinations.length).toBeGreaterThan(1)
      expect(result.combinations.some((c) => c.strategy === 'split')).toBe(true)
      expect(result.combinations.some((c) => c.strategy === 'package')).toBe(true)
      const best = result.combinations[0]!
      expect(best.total.amount).toBeGreaterThan(0)
      expect(best.valueScore).toBeGreaterThan(0)
      // Sorted by value then cost — first is not necessarily cheapest raw sum.
      const cheapest = [...result.combinations].sort((a, b) => a.total.amount - b.total.amount)[0]!
      expect(best.valueScore).toBeGreaterThanOrEqual(cheapest.valueScore - 0.0001)
    })
  })

  describe('booking readiness', () => {
    it('marks ready when critical slots are filled', () => {
      const ready = assessBookingReadiness({
        requirements: {
          ...emptyRequirements(),
          destination: 'Tokyo',
          destinations: ['Tokyo'],
          startDate: '2026-08-01',
          durationDays: 5,
          travelers: 2,
          budgetAmount: 8000,
          budgetCurrency: 'SAR',
        },
        missingFields: [],
        locale: 'en',
        hasRankedOffers: true,
      })
      expect(ready.bookingReady).toBe(true)
      expect(ready.clarification).toBeNull()
    })

    it('returns a single highest-priority clarification otherwise', () => {
      const blocked = assessBookingReadiness({
        requirements: {
          ...emptyRequirements(),
          destination: null,
          destinations: [],
          durationDays: null,
          travelers: null,
          budgetAmount: null,
        },
        missingFields: ['destination', 'durationDays', 'travelers', 'budgetAmount'],
        locale: 'en',
      })
      expect(blocked.bookingReady).toBe(false)
      expect(blocked.priorityField).toBe('destination')
      expect(blocked.clarification).toMatch(/destination/i)
      expect(blocked.missingFields[0]).toBe('destination')
    })
  })

  describe('confidence and explanations', () => {
    it('returns confidence, reasons, alternatives, and user-facing WHY', async () => {
      const result = await runBookingIntelligence({
        userId: 'conf-55',
        memory: {
          ...emptyMemory('en'),
          requirements: {
            ...emptyRequirements(),
            destination: 'Tokyo',
            destinations: ['Tokyo'],
            origin: 'RUH',
            startDate: '2026-09-01',
            durationDays: 5,
            travelers: 2,
            budgetAmount: 15000,
            budgetCurrency: 'SAR',
            budgetStyle: 'midrange',
            hotelPreference: 'central',
          },
          missingFields: [],
        },
      })
      expect(result.confidence.confidence).toBeGreaterThan(0.3)
      expect(result.confidence.reasons.length).toBeGreaterThan(0)
      expect(result.confidence.alternatives.length).toBeGreaterThan(0)
      expect(result.explanations[0]?.explanation.length).toBeGreaterThan(20)
      expect(result.explanations[0]?.explanation.toLowerCase()).not.toMatch(/rankscore|rankfactors|internal/)
      expect(result.recommendationFacts.length).toBeGreaterThan(0)

      const confidence = buildRecommendationConfidence({
        ranked: result.ranked,
        combinations: result.combinations,
        readiness: result.readiness,
        locale: 'en',
      })
      expect(confidence.alternatives[0]?.why).toBeTruthy()

      const explained = explainRecommendations({
        ranked: result.ranked,
        combinations: result.combinations,
        locale: 'en',
      })
      expect(explained[0]?.explanation).toMatch(/I |This /)
    })
  })

  describe('planTurn integration', () => {
    it('attaches booking intelligence meta without changing Conversation Brain authorship', async () => {
      const service = createTravelAgentService({
        concierge: false,
        autonomousAgentEnabled: true,
        bookingIntelligenceEnabled: true,
      })
      const turn = await service.planTurn({
        conversationId: 'c-55',
        messages: [user(COMPLETE_JAPAN_5D)],
      })
      expect(turn.tripPlan?.destinations).toContain('Japan')
      expect(turn.meta.bookingIntelligence).toBeTruthy()
      expect(turn.meta.bookingIntelligence?.rankedCount).toBeGreaterThan(0)
      expect(turn.meta.bookingIntelligence?.providerIds.length).toBeGreaterThan(0)
      expect(turn.meta.bookingIntelligence?.topConfidence).toBeGreaterThan(0)
      expect(turn.meta.spokenText).toBeTruthy()
      expect(turn.reply.toLowerCase()).not.toMatch(/next question|سؤال التالي|decision engine/)
    })

    it('can disable booking intelligence without breaking planTurn', async () => {
      const service = createTravelAgentService({
        concierge: false,
        bookingIntelligenceEnabled: false,
      })
      const turn = await service.planTurn({
        conversationId: 'c-55-off',
        messages: [user(COMPLETE_JAPAN_5D, 'c-55-off')],
      })
      expect(turn.tripPlan?.destinations).toContain('Japan')
      expect(turn.meta.bookingIntelligence).toBeUndefined()
      expect(turn.meta.spokenText).toBeTruthy()
    })
  })
})
