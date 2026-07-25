/**
 * Evolution Sprint 7 — Destination Intelligence Layer tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  DESTINATION_INTELLIGENCE_FEATURE_ID,
  isDestinationIntelligenceEnabled,
  runDestinationIntelligence,
  tryRunDestinationIntelligence,
  findDestinationKnowledge,
  compareDestinations,
  matchTravelerScore,
  analyzeSeason,
  DestinationIntelligence,
} from '../agent/destination'
import { runRecommendationEngine } from '../agent/recommendation'
import { createTravelerModel } from '../agent/traveler'
import { createPlanningGraph } from '../agent/planningGraph'
import { runConsultantReasoningPipeline } from '../agent/reasoning'

describe('Evolution Sprint 7 — Destination Intelligence Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.destination_intelligence default OFF', () => {
      expect(getFeatureRegistry().isEnabled(DESTINATION_INTELLIGENCE_FEATURE_ID)).toBe(false)
      expect(isDestinationIntelligenceEnabled()).toBe(false)
      expect(tryRunDestinationIntelligence({ destinationQuery: 'Japan' })).toBeNull()
      expect(
        tryRunDestinationIntelligence({ destinationQuery: 'Japan', locale: 'en', enabled: true }),
      ).not.toBeNull()
    })
  })

  describe('English snapshot', () => {
    it('builds Destination Snapshot / DNA / strengths / weaknesses', () => {
      const result = runDestinationIntelligence({
        locale: 'en',
        destinationQuery: 'Japan',
        traveler: {
          purpose: 'cultural',
          foodLean: 0.8,
          cityLean: 0.7,
          monthHint: 4,
        },
        monthHint: 4,
      })
      expect(result.snapshot).toBeTruthy()
      const snap = result.snapshot!
      expect(snap.name).toBe('Japan')
      expect(snap.destinationDna.primaryCharacter).toBeTruthy()
      expect(snap.strengths.length).toBeGreaterThan(0)
      expect(snap.weaknesses.length).toBeGreaterThan(0)
      expect(snap.bestTravelerMatch.length).toBeGreaterThan(0)
      expect(snap.whoShouldAvoid.length).toBeGreaterThan(0)
      expect(snap.confidence).toBeGreaterThan(0.5)
      expect(snap.evidence.length).toBeGreaterThan(0)
      expect(snap.missingKnowledge.length).toBeGreaterThan(0)
      expect(snap.scores.food).toBeGreaterThan(80)
      expect(snap.scores.seasonFit).toBeGreaterThan(70)
      expect(snap.seasonal.bestSeasons).toContain(4)
      expect(snap.summary).toMatch(/Japan/)
    })
  })

  describe('Arabic', () => {
    it('resolves Arabic names and summarizes in Arabic', () => {
      const result = runDestinationIntelligence({
        locale: 'ar',
        destinationQuery: 'دبي',
        traveler: { purpose: 'family', familyLean: 0.9 },
      })
      expect(result.snapshot?.name).toBe('دبي')
      expect(result.snapshot?.summary).toMatch(/دبي|طابع|ثقة/)
      expect(result.snapshot?.scores.family).toBeGreaterThan(85)
    })
  })

  describe('destination comparison', () => {
    it('compares Japan vs Korea', () => {
      const cmp = compareDestinations('Japan', 'Korea', {
        purpose: 'cultural',
        foodLean: 0.7,
        cityLean: 0.6,
      })
      expect(cmp).toBeTruthy()
      expect(cmp!.leftId).toBe('japan')
      expect(cmp!.rightId).toBe('korea')
      expect(cmp!.reasons.length).toBeGreaterThan(0)
      expect(cmp!.leftStrengths.length).toBeGreaterThan(0)
      expect(cmp!.travelerMatch).toBeTruthy()
    })

    it('compares Paris vs Rome, Bali vs Phuket, Morocco vs Spain', () => {
      expect(compareDestinations('Paris', 'Rome')?.reasons.length).toBeGreaterThan(0)
      expect(compareDestinations('Bali', 'Phuket')?.reasons.length).toBeGreaterThan(0)
      expect(compareDestinations('Morocco', 'Spain')?.reasons.length).toBeGreaterThan(0)
    })
  })

  describe('traveler matching', () => {
    it('prefers Bali for nature/adventure over Paris', () => {
      const bali = findDestinationKnowledge('Bali')!
      const paris = findDestinationKnowledge('Paris')!
      const traveler = { purpose: 'adventure', natureLean: 0.9, adventureLean: 0.8 }
      const b = matchTravelerScore(bali, traveler)
      const p = matchTravelerScore(paris, traveler)
      expect(b.score).toBeGreaterThan(p.score)
    })

    it('prefers Dubai for luxury family', () => {
      const dubai = findDestinationKnowledge('Dubai')!
      const score = matchTravelerScore(dubai, {
        purpose: 'family',
        familyLean: 0.9,
        luxuryLean: 0.8,
        budgetStance: 'comfort_first',
      })
      expect(score.score).toBeGreaterThan(55)
    })
  })

  describe('seasonality', () => {
    it('scores best vs worst months for Phuket', () => {
      const phuket = findDestinationKnowledge('Phuket')!
      const best = analyzeSeason(phuket, 1)
      const worst = analyzeSeason(phuket, 7)
      expect(best.fitScore).toBeGreaterThan(worst.fitScore)
      expect(phuket.bestSeasons).toContain(1)
      expect(phuket.worstSeasons).toContain(7)
    })
  })

  describe('regression — freeze boundaries', () => {
    it('does not export planTurn; other layers remain callable', async () => {
      const mod = await import('../agent/destination')
      expect('planTurn' in mod).toBe(false)
      expect(typeof mod.runDestinationIntelligence).toBe('function')

      expect(
        runConsultantReasoningPipeline({ locale: 'en', userText: 'Japan ideas' }).recommendation,
      ).toBeTruthy()
      expect(createTravelerModel('en').id).toBeTruthy()
      expect(createPlanningGraph('en').id).toBeTruthy()
      expect(
        runRecommendationEngine({
          locale: 'en',
          candidates: [{ id: 'x', label: 'X', destinations: ['Japan'], confidence: 0.7 }],
        }).package.primaryRecommendation,
      ).toBeTruthy()

      expect(DestinationIntelligence.find('Istanbul')?.id).toBe('istanbul')
      expect(
        runDestinationIntelligence({
          destinationQuery: 'Tokyo',
          compareWith: 'Seoul',
          locale: 'en',
        }).comparison?.leftId,
      ).toBe('japan')
    })
  })
})
