/**
 * Sprint 91 — Production Alpha Experience tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  aggregateConfidence,
  buildAlphaExplanation,
  buildAlternativeScenarios,
  buildBudgetAdjustmentPrompt,
  createProgressTimeline,
  ProgressTimelineTracker,
  presentRecommendation,
  runAlphaExperience,
  toTravelerRecoveryMessage,
  SPRINT91_ALPHA_EXPERIENCE_VERSION,
  createMockTravelProvider,
  createProviderRegistry,
  type PackageBuilderResult,
  type DecisionEngineResult,
} from '../../core'
import {
  isAlphaExperienceEnabled,
  runAlphaExperienceConversation,
  ALPHA_EXPERIENCE_FEATURE_ID,
} from '../agent/alphaExperience'

describe('Sprint 91 — Production Alpha Experience', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai.alpha_experience enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.alpha_experience')).toBe(true)
    expect(isAlphaExperienceEnabled()).toBe(true)
    expect(ALPHA_EXPERIENCE_FEATURE_ID).toBe('ai.alpha_experience')
    expect(SPRINT91_ALPHA_EXPERIENCE_VERSION).toMatch(/alpha-experience/)
  })

  describe('timeline', () => {
    it('tracks stages with status, timestamps, duration, and progress', () => {
      const tracker = new ProgressTimelineTracker(createProgressTimeline())
      tracker.start('analyzing_request')
      tracker.complete('analyzing_request', 'done')
      tracker.start('searching_flights')
      tracker.failRecoverable('searching_flights', 'PROVIDER_UNAVAILABLE', 'Searching alternative flights...')
      const finished = tracker.finish()

      expect(finished.stages.length).toBeGreaterThanOrEqual(10)
      expect(finished.hasRecoverableFailure).toBe(true)
      expect(finished.progressPercent).toBe(100)
      expect(finished.completedAt).toBeTruthy()
      expect(finished.durationMs).toBeGreaterThanOrEqual(0)

      const analyzing = finished.stages.find((s) => s.id === 'analyzing_request')
      expect(analyzing?.status).toBe('completed')
      expect(analyzing?.startedAt).toBeTruthy()
      expect(analyzing?.progressPercent).toBeGreaterThan(0)

      const flights = finished.stages.find((s) => s.id === 'searching_flights')
      expect(flights?.status).toBe('recovered')
      expect(flights?.recoverable).toBe(true)
      expect(flights?.message).toMatch(/alternative flights/i)
    })
  })

  describe('confidence aggregation', () => {
    it('aggregates flight/hotel/package/decision confidence with reasoning', () => {
      const conf = aggregateConfidence({
        flightConfidence: 0.9,
        hotelConfidence: 0.8,
        packageConfidence: 0.85,
        decisionConfidence: 80,
        refinementConfidence: 0.88,
        constitutionOk: true,
      })
      expect(conf.overall).toBeGreaterThan(0.7)
      expect(conf.flight).toBe(0.9)
      expect(conf.hotel).toBe(0.8)
      expect(conf.package).toBe(0.85)
      expect(conf.decision).toBe(0.8)
      expect(conf.reasoningSummary).toMatch(/package|decision/i)
    })

    it('caps overall confidence when constitution fails', () => {
      const conf = aggregateConfidence({
        flightConfidence: 0.95,
        hotelConfidence: 0.95,
        packageConfidence: 0.95,
        decisionConfidence: 0.95,
        constitutionOk: false,
      })
      expect(conf.overall).toBeLessThanOrEqual(0.55)
    })
  })

  describe('explanations', () => {
    it('builds natural-language explanations without prompt leakage', () => {
      const explanation = buildAlphaExplanation({
        flightAirline: 'Saudia',
        flightPrice: 1200,
        hotelName: 'City Hotel',
        hotelPrice: 1500,
        packageTitle: 'Saudia + City Hotel',
        packageScore: 82,
        currency: 'SAR',
        budgetCap: 5000,
        totalPrice: 2900,
        durationMinutes: 180,
        decisionExplanation: 'Best overall fit for Dubai.',
      })
      expect(explanation.whyFlight).toMatch(/Saudia/)
      expect(explanation.whyHotel).toMatch(/City Hotel/)
      expect(explanation.whyPackage).toMatch(/Saudia \+ City Hotel/)
      expect(explanation.tradeoffs.length).toBeGreaterThan(0)
      expect(explanation.budgetImpact).toMatch(/under|budget|SAR/i)
      expect(explanation.summary).not.toMatch(/system prompt|you are an ai/i)
    })
  })

  describe('error experience', () => {
    it('converts technical failures into recoverable traveler messages', () => {
      expect(toTravelerRecoveryMessage('PROVIDER_UNAVAILABLE', 'flights'))
        .toMatch(/alternative flights/i)
      expect(toTravelerRecoveryMessage('timeout', 'provider'))
        .toMatch(/another provider/i)
      expect(toTravelerRecoveryMessage('empty package', 'package'))
        .toMatch(/adjust your budget/i)
      expect(buildBudgetAdjustmentPrompt('SAR', 3000))
        .toMatch(/3000 SAR/)
      expect(toTravelerRecoveryMessage('circuit_open', 'hotels'))
        .not.toMatch(/circuit_open|stack|exception/i)
    })
  })

  describe('alternatives', () => {
    it('generates scenario variants with explanations', () => {
      const packages = {
        selected: { id: 'pkg1', totalPrice: 3000, currency: 'SAR', confidence: 0.8, explanation: 'Value pick', labels: ['best_value'] },
        ranked: [
          { id: 'pkg1', totalPrice: 3000, currency: 'SAR', confidence: 0.8, explanation: 'Value', labels: ['best_value'], components: [], reasons: [] },
          { id: 'pkg2', totalPrice: 2200, currency: 'SAR', confidence: 0.7, explanation: 'Budget', labels: ['best_budget'], components: [], reasons: [] },
          { id: 'pkg3', totalPrice: 7000, currency: 'SAR', confidence: 0.75, explanation: 'Luxury', labels: ['luxury'], components: [], reasons: [] },
        ],
        labels: {
          bestOverall: null,
          bestBudget: { id: 'pkg2', totalPrice: 2200, currency: 'SAR', confidence: 0.7, explanation: 'Budget', labels: ['best_budget'] },
          bestBusiness: null,
          bestFamily: null,
          bestLuxury: { id: 'pkg3', totalPrice: 7000, currency: 'SAR', confidence: 0.75, explanation: 'Luxury', labels: ['luxury'] },
          bestWeekend: null,
          bestValue: { id: 'pkg1', totalPrice: 3000, currency: 'SAR', confidence: 0.8, explanation: 'Value', labels: ['best_value'] },
        },
      } as unknown as PackageBuilderResult

      const decision = {
        recommendations: {
          bestOverall: { id: 'c1', totalPrice: 3000 },
          bestBudget: { id: 'c2', totalPrice: 2200, score: { confidence: 70 } },
          fastest: { id: 'c3', totalPrice: 3500, score: { confidence: 72 } },
          bestComfort: { id: 'c4', totalPrice: 5000, score: { confidence: 74 } },
          bestFamily: null,
          explanation: 'x',
          confidence: 80,
          ranked: [],
        },
      } as unknown as DecisionEngineResult

      const alts = buildAlternativeScenarios({
        packages,
        decision,
        primaryPackageId: 'pkg1',
      })
      expect(alts.length).toBeGreaterThanOrEqual(3)
      expect(alts.some((a) => a.kind === 'best_value')).toBe(true)
      expect(alts.some((a) => a.kind === 'cheapest')).toBe(true)
      expect(alts.every((a) => a.explanation.length > 0)).toBe(true)
    })
  })

  describe('recommendation presenter', () => {
    it('builds presentation-ready recommendation object', () => {
      const packages = {
        selected: {
          id: 'pkg1',
          title: 'Saudia + City Hotel',
          currency: 'SAR',
          totalPrice: 3200,
          destination: 'Dubai',
          checkIn: '2026-08-15',
          checkOut: '2026-08-20',
          confidence: 0.84,
          score: 81,
          providerConfidence: 0.88,
          explanation: 'Strong overall package.',
          reasons: ['Good value', 'Solid timing'],
          components: [
            {
              id: 'f1',
              kind: 'flight',
              title: 'Saudia',
              price: 1200,
              currency: 'SAR',
              payload: { airline: 'Saudia', origin: 'Riyadh', destination: 'Dubai', durationMinutes: 190, stops: 0 },
            },
            {
              id: 'h1',
              kind: 'hotel',
              title: 'City Hotel',
              price: 1800,
              currency: 'SAR',
              payload: { name: 'City Hotel', stars: 4, rating: 8.1, destination: 'Dubai' },
            },
            {
              id: 't1',
              kind: 'transfer',
              title: 'Airport transfer',
              price: 120,
              currency: 'SAR',
              payload: {},
            },
            {
              id: 'a1',
              kind: 'activity',
              title: 'City tour',
              price: 200,
              currency: 'SAR',
              payload: {},
            },
          ],
          labels: ['best_value'],
        },
        ranked: [],
        labels: {
          bestOverall: null,
          bestBudget: null,
          bestBusiness: null,
          bestFamily: null,
          bestLuxury: null,
          bestWeekend: null,
          bestValue: null,
        },
      } as unknown as PackageBuilderResult

      const decision = {
        recommendations: {
          explanation: 'Best overall fit for Dubai.',
          confidence: 82,
          bestOverall: { id: 'c1' },
          bestBudget: null,
          fastest: null,
          bestComfort: null,
          bestFamily: null,
          ranked: [],
        },
      } as unknown as DecisionEngineResult

      const rec = presentRecommendation({
        requirements: {
          destination: 'Dubai',
          origin: 'Riyadh',
          startDate: '2026-08-15',
          endDate: '2026-08-20',
          durationDays: 5,
          travelers: 2,
          budgetAmount: 8000,
          budgetCurrency: 'SAR',
        },
        packages,
        refinement: null,
        decision,
        constitutionOk: true,
      })

      expect(rec.tripSummary.destination).toBe('Dubai')
      expect(rec.flights[0]?.airline).toBe('Saudia')
      expect(rec.hotels[0]?.name).toBe('City Hotel')
      expect(rec.transportation.length).toBe(1)
      expect(rec.activities.length).toBe(1)
      expect(rec.estimatedCost).toBe(3200)
      expect(rec.confidence.overall).toBeGreaterThan(0.5)
      expect(rec.explanation.whyFlight).toBeTruthy()
      expect(rec.explanation.whyHotel).toBeTruthy()
      expect(rec.explanation.whyPackage).toBeTruthy()
      expect(rec.recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('end-to-end orchestration', () => {
    it('runs complete conversation flow with timeline and recommendation', async () => {
      const result = await runAlphaExperience({
        conversationId: 'alpha-e2e-1',
        userText: 'Plan a 5-day Dubai trip from Riyadh for 2 adults, budget 8000 SAR',
        intent: 'plan_trip',
        requirements: {
          destination: 'Dubai',
          origin: 'Riyadh',
          startDate: '2026-08-15',
          endDate: '2026-08-20',
          durationDays: 5,
          travelers: 2,
          travelerType: 'couple',
          budgetAmount: 8000,
          budgetCurrency: 'SAR',
          interests: ['shopping', 'food'],
        },
      })

      expect(result.version).toMatch(/alpha-experience/)
      expect(result.timeline.progressPercent).toBe(100)
      expect(result.timeline.stages.some((s) => s.id === 'completed' && s.status === 'completed')).toBe(true)
      expect(result.recommendation.tripSummary.destination).toBe('Dubai')
      expect(result.recommendation.estimatedCost).toBeGreaterThan(0)
      expect(result.recommendation.confidence.overall).toBeGreaterThan(0)
      expect(result.recommendation.explanation.summary.length).toBeGreaterThan(0)
      expect(result.alternativeCount).toBeGreaterThan(0)
      expect(result.searchPlanCount).toBeGreaterThan(0)
      expect(result.packageCount).toBeGreaterThan(0)

      const eventNames = result.events.map((e) => e.name)
      expect(eventNames).toContain('conversation.started')
      expect(eventNames).toContain('search.completed')
      expect(eventNames).toContain('package.completed')
      expect(eventNames).toContain('refinement.completed')
      expect(eventNames).toContain('decision.completed')
      expect(eventNames).toContain('recommendation.generated')
      expect(eventNames).toContain('conversation.completed')
    })

    it('recovers when primary provider fails using failover', async () => {
      const registry = createProviderRegistry()
      registry.register(
        createMockTravelProvider({ id: 'primary-down', failFlights: true, failHotels: true }),
        { tier: 'primary', rank: 1 },
      )
      registry.register(
        createMockTravelProvider({ id: 'backup-ok' }),
        { tier: 'fallback', rank: 10 },
      )

      const result = await runAlphaExperience({
        userText: 'Trip to Dubai from Riyadh',
        requirements: {
          destination: 'Dubai',
          origin: 'Riyadh',
          startDate: '2026-08-15',
          endDate: '2026-08-20',
          budgetAmount: 7000,
          budgetCurrency: 'SAR',
          travelers: 2,
        },
        providerRegistry: registry,
      })

      expect(result.recommendation.estimatedCost).toBeGreaterThan(0)
      expect(result.events.some((e) => e.name === 'recommendation.generated')).toBe(true)
      // Either failover succeeded quietly or recovery messages were emitted — never empty tech dumps.
      for (const msg of result.recommendation.recoveryMessages) {
        expect(msg).not.toMatch(/TypeError|stack|ECONNREFUSED/i)
      }
    })

    it('agent bridge extracts intent and returns meta + facts', async () => {
      const response = await runAlphaExperienceConversation({
        conversationId: 'bridge-1',
        userText: 'أريد رحلة إلى دبي من الرياض لمدة ٥ أيام بميزانية ٨٠٠٠ ريال',
      })

      expect(response.enabled).toBe(true)
      expect(response.result).toBeTruthy()
      expect(response.meta?.conversationId).toBe('bridge-1')
      expect(response.meta?.overallConfidence).toBeGreaterThan(0)
      expect(response.recommendationFacts.length).toBeGreaterThan(0)
      expect(response.memory.requirements.destination).toBeTruthy()
    })

    it('respects feature flag off', async () => {
      getFeatureRegistry().setEnabled('ai.alpha_experience', false)
      const response = await runAlphaExperienceConversation({
        userText: 'Plan Dubai trip',
      })
      expect(response.enabled).toBe(false)
      expect(response.result).toBeNull()
    })
  })
})
