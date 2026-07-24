/**
 * Evolution Sprint 5 — Traveler Intelligence Layer tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  TRAVELER_INTELLIGENCE_FEATURE_ID,
  isTravelerIntelligenceEnabled,
  createTravelerModel,
  tryCreateTravelerModel,
  observeTraveler,
  tryObserveTraveler,
  TravelerModel,
  evolvePreference,
  getPreference,
  buildTravelDna,
  buildTravelerSnapshot,
} from '../agent/traveler'
import { createPlanningGraph, PlanningGraph } from '../agent/planningGraph'
import { createReflectionSession, reflectTurn } from '../agent/reflection'
import { runConsultantReasoningPipeline } from '../agent/reasoning'

describe('Evolution Sprint 5 — Traveler Intelligence Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.traveler_intelligence default OFF', () => {
      expect(getFeatureRegistry().isEnabled(TRAVELER_INTELLIGENCE_FEATURE_ID)).toBe(false)
      expect(isTravelerIntelligenceEnabled()).toBe(false)
      expect(tryCreateTravelerModel('en')).toBeNull()
      expect(tryCreateTravelerModel('en', { enabled: true })).not.toBeNull()
    })
  })

  describe('English conversations', () => {
    it('infers luxury, comfort, and food exploration', () => {
      const model = createTravelerModel('en')
      const { snapshot, signals } = observeTraveler(model, {
        locale: 'en',
        userText: 'We want a luxury honeymoon with great food and spa comfort, direct flights preferred',
        conversationSource: 'chat:1',
        reasoningRef: 'r1',
        reflectionRef: 'f1',
      })
      expect(signals.length).toBeGreaterThan(0)
      expect(getPreference(model, 'luxury_preference')?.value).toBe('high')
      expect(getPreference(model, 'comfort_preference')?.value).toBe('high')
      expect(getPreference(model, 'food_exploration')?.value).toBe('high')
      expect(getPreference(model, 'travel_style')?.value).toMatch(/luxury|romantic/)
      expect(snapshot.travelDna.primaryStyle).toBeTruthy()
      expect(snapshot.personality.traits.length).toBeGreaterThan(0)
      expect(snapshot.planningBias.preferComfort).toBe(true)
      expect(snapshot.recommendationBias.weightLuxury).toBeGreaterThan(0.5)
      const lux = getPreference(model, 'luxury_preference')!
      expect(lux.evidence[0]?.reasoningRef).toBe('r1')
      expect(lux.evidence[0]?.reflectionRef).toBe('f1')
      expect(lux.evidence[0]?.conversationSource).toBe('chat:1')
      expect(lux.updatedAt).toBeTruthy()
    })

    it('infers family + low risk + city lean', () => {
      const model = TravelerModel.create('en')
      TravelerModel.observe(model, {
        locale: 'en',
        userText: 'Safe family city trip with kids, walkable areas and mild weather',
      })
      expect(getPreference(model, 'family_friendliness')?.lean).toBeGreaterThan(0.5)
      expect(getPreference(model, 'risk_tolerance')?.value).toBe('low')
      expect(getPreference(model, 'nature_vs_cities')?.value).toBe('cities')
      expect(getPreference(model, 'climate_preference')?.value).toBe('mild')
    })
  })

  describe('Arabic conversations', () => {
    it('infers family, Dubai affinity, and flexible budget', () => {
      const model = createTravelerModel('ar')
      const { snapshot } = observeTraveler(model, {
        locale: 'ar',
        userText: 'نبغى رحلة عائلية لدبي بميزانية مرنة وأكل حلو',
        conversationSource: 'chat:ar1',
      })
      expect(getPreference(model, 'family_friendliness')?.value).toBe('high')
      expect(getPreference(model, 'destination_affinity')?.value).toBe('Dubai')
      expect(getPreference(model, 'budget_flexibility')?.value).toBe('high')
      expect(getPreference(model, 'food_exploration')?.value).toBe('high')
      expect(snapshot.summary).toMatch(/نموذج|تفضيلات/)
      expect(snapshot.recommendationBias.favorDestinations).toContain('Dubai')
    })
  })

  describe('preference evolution + confidence', () => {
    it('evolves with weighted updates and does not hard-overwrite', () => {
      const model = createTravelerModel('en')
      observeTraveler(model, {
        locale: 'en',
        userText: 'Keep it cheap and basic stay',
        now: new Date('2026-07-24T10:00:00.000Z'),
      })
      const first = getPreference(model, 'luxury_preference')
      expect(first?.value).toBe('low')
      const firstConf = first!.confidence

      observeTraveler(model, {
        locale: 'en',
        userText: 'Actually we prefer luxury five star hotels',
        now: new Date('2026-07-24T10:05:00.000Z'),
      })
      const second = getPreference(model, 'luxury_preference')!
      expect(second.evidence.length).toBeGreaterThan(first!.evidence.length)
      // Confidence and lean evolve; contradictions retained when conflicting
      expect(second.contradictions.length).toBeGreaterThan(0)
      expect(second.updatedAt).not.toBe(first!.updatedAt)
      expect(typeof second.confidence).toBe('number')
      expect(model.confidenceHistory.length).toBe(2)
      expect(second.confidence).not.toBe(firstConf) // may rise or blend
    })

    it('unit: evolvePreference blends leans without immediate overwrite on weak signal', () => {
      const prior = evolvePreference(undefined, {
        key: 'pace',
        value: 'relaxed',
        lean: -0.8,
        confidence: 0.8,
        evidence: [],
        timestamp: '2026-07-24T10:00:00.000Z',
        conversationSource: 't1',
        reasoningRef: null,
        reflectionRef: null,
      })
      const next = evolvePreference(prior, {
        key: 'pace',
        value: 'packed',
        lean: 0.8,
        confidence: 0.4,
        evidence: [],
        timestamp: '2026-07-24T10:01:00.000Z',
        conversationSource: 't2',
        reasoningRef: null,
        reflectionRef: null,
      })
      // Weak conflicting signal should not fully replace a strong prior value
      expect(next.value).toBe('relaxed')
      expect(next.contradictions.length).toBeGreaterThan(0)
      expect(next.lean).toBeGreaterThan(prior.lean) // pulled toward packed
    })
  })

  describe('contradictory inputs', () => {
    it('records contradictions for nightlife high then low', () => {
      const model = createTravelerModel('en')
      observeTraveler(model, { userText: 'We love nightlife and bars', locale: 'en' })
      expect(getPreference(model, 'nightlife_preference')?.value).toBe('high')
      observeTraveler(model, {
        userText: 'Actually no nightlife, quiet nights only',
        locale: 'en',
      })
      const night = getPreference(model, 'nightlife_preference')!
      expect(night.contradictions.length).toBeGreaterThan(0)
      expect(night.evidence.length).toBeGreaterThan(1)
    })
  })

  describe('snapshot outputs', () => {
    it('builds Travel DNA, personality, planning and recommendation bias', () => {
      const model = createTravelerModel('en')
      observeTraveler(model, {
        locale: 'en',
        userText:
          'Adventure trek in Georgia, packed itinerary, love photography and walking a lot, cold weather ok',
      })
      const dna = buildTravelDna(model)
      expect(dna.primaryStyle).toMatch(/adventure|emerging/)
      expect(dna.signature.length).toBeGreaterThan(0)
      const snap = buildTravelerSnapshot(model)
      expect(snap.personality.summary).toMatch(/behavioral|style/i)
      expect(snap.planningBias.clarifyAggressiveness).toBeTruthy()
      expect(snap.recommendationBias.weightAdventure).toBeGreaterThan(0.5)
      expect(snap.recommendationBias.weightNature).toBeGreaterThan(0)
      expect(getPreference(model, 'photography_interest')?.value).toBe('high')
      expect(getPreference(model, 'walking_tolerance')?.value).toBe('high')
      expect(getPreference(model, 'climate_preference')?.value).toBe('cold')
    })
  })

  describe('regression — freeze boundaries', () => {
    it('does not export planTurn; other layers remain callable', async () => {
      const mod = await import('../agent/traveler')
      expect('planTurn' in mod).toBe(false)
      expect(typeof mod.observeTraveler).toBe('function')

      expect(runConsultantReasoningPipeline({ locale: 'en', userText: 'trip ideas' }).recommendation).toBeTruthy()

      const session = createReflectionSession('en')
      expect(
        reflectTurn(session, { userText: 'trip ideas', locale: 'en', enabled: true }).latestRecommendation,
      ).toBeTruthy()

      const graph = createPlanningGraph('en')
      expect(PlanningGraph.addRoot(graph, { locale: 'en', label: 'x' }).id).toBeTruthy()

      expect(tryObserveTraveler(createTravelerModel('en'), { userText: 'hi' })).toBeNull()
    })
  })
})
