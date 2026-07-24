/**
 * Evolution Sprint 8 — Travel Strategy Intelligence tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  TRAVEL_STRATEGY_FEATURE_ID,
  isTravelStrategyEnabled,
  runTravelStrategyEngine,
  tryRunTravelStrategyEngine,
  TravelStrategyEngine,
  formatStrategyResult,
  type TravelStrategyContext,
} from '../agent/travelStrategy'
import { findDestinationKnowledge } from '../agent/destination'
import { runConsultantReasoningPipeline } from '../agent/reasoning'

function ctx(partial: TravelStrategyContext): TravelStrategyContext {
  return partial
}

describe('Evolution Sprint 8 — Travel Strategy Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.travel_strategy default OFF', () => {
      expect(getFeatureRegistry().isEnabled(TRAVEL_STRATEGY_FEATURE_ID)).toBe(false)
      expect(isTravelStrategyEnabled()).toBe(false)
      expect(tryRunTravelStrategyEngine(ctx({ destinationLabel: 'Paris' }))).toBeNull()
      expect(
        tryRunTravelStrategyEngine(ctx({ destinationLabel: 'Paris', enabled: true, locale: 'en' })),
      ).not.toBeNull()
    })
  })

  describe('does not choose destinations', () => {
    it('keeps destination as context only', () => {
      const japan = findDestinationKnowledge('Japan')!
      const result = runTravelStrategyEngine(
        ctx({
          locale: 'en',
          destinationLabel: japan.nameEn,
          monthHint: 4,
          budgetAmount: 15000,
          budgetCurrency: 'SAR',
          durationDays: 10,
          purpose: 'cultural',
          destinationPriors: {
            bestSeasons: japan.bestSeasons,
            worstSeasons: japan.worstSeasons,
            costBand: japan.costExpectations,
            safetyBand: japan.safetyBand,
            transportationQuality: japan.transportationQuality,
            recommendedStayDays: japan.recommendedStayDays,
            strengths: japan.topStrengths,
            weaknesses: japan.knownWeaknesses,
            crowdByMonth: japan.crowdByMonth,
            climateByMonth: japan.climateByMonth,
            visaComplexity: japan.visaComplexity,
          },
        }),
      )
      expect(result.destinationContext).toBe('Japan')
      expect(result.primary.whyNot.some((w) => /does not pick a new destination/i.test(w))).toBe(true)
      expect(result.byKind.primary).toBeTruthy()
      expect(result.byKind.budget).toBeTruthy()
      expect(result.byKind.comfort).toBeTruthy()
      expect(result.byKind.luxury).toBeTruthy()
      expect(result.byKind.fastest).toBeTruthy()
      expect(result.byKind.highest_value).toBeTruthy()
      expect(result.byKind.lowest_risk).toBeTruthy()
      expect(result.byKind.best_time).toBeTruthy()
      expect(result.byKind.alternative).toBeTruthy()
    })
  })

  describe('English strategy package fields', () => {
    it('explains why / tradeoffs / risks / opportunity cost / confidence', () => {
      const result = runTravelStrategyEngine(
        ctx({
          locale: 'en',
          destinationLabel: 'Paris',
          monthHint: 8,
          budgetAmount: 8000,
          budgetStance: 'strict',
          durationDays: 5,
          riskTolerance: 'low',
          destinationPriors: {
            bestSeasons: [4, 5, 6, 9, 10],
            worstSeasons: [1, 2, 8],
            costBand: 'luxury',
            safetyBand: 'moderate',
            visaComplexity: 'complex',
            recommendedStayDays: { min: 4, ideal: 6, max: 10 },
            weaknesses: ['August crowds'],
            crowdByMonth: Array.from({ length: 12 }, (_, i) => (i === 7 ? 'peak' : 'moderate')),
            climateByMonth: Array.from({ length: 12 }, (_, i) => (i === 7 ? 'hot' : 'mild')),
          },
          travelerHints: { preferValueOverCheapest: true },
        }),
      )
      const p = result.primary
      expect(p.why.length).toBeGreaterThan(0)
      expect(p.whyNot.length).toBeGreaterThan(0)
      expect(p.tradeoffs.length).toBeGreaterThan(0)
      expect(p.risks.length).toBeGreaterThan(0)
      expect(p.opportunityCost.length).toBeGreaterThan(0)
      expect(p.expectedValue.length).toBeGreaterThan(0)
      expect(p.confidence).toBeGreaterThan(0)
      expect(p.evidence.length).toBeGreaterThan(0)
      expect(p.scores.overallValue).toBeGreaterThan(0)
      expect(p.levers.goNowOrLater).toMatch(/later|either|now|unknown/)
      // August in worst seasons → prefer later
      expect(result.byKind.best_time?.levers.goNowOrLater).toMatch(/later|either/)
      const formatted = formatStrategyResult(result)
      expect(formatted.headline).toBeTruthy()
      expect(formatted.primaryBrief).toMatch(/strategy|Collect|Proposed/i)
    })
  })

  describe('Arabic', () => {
    it('produces Arabic titles and clarification', () => {
      const result = runTravelStrategyEngine(
        ctx({
          locale: 'ar',
          destinationLabel: 'دبي',
          monthHint: 1,
          budgetAmount: 12000,
          durationDays: 5,
          destinationPriors: {
            bestSeasons: [11, 12, 1, 2, 3],
            worstSeasons: [6, 7, 8],
            costBand: 'luxury',
            safetyBand: 'high',
            visaComplexity: 'easy',
          },
        }),
      )
      expect(result.primary.title).toMatch(/استراتيجية/)
      expect(TravelStrategyEngine.format(result).headline).toBeTruthy()
    })
  })

  describe('low confidence', () => {
    it('requests clarification when information is sparse', () => {
      const result = runTravelStrategyEngine(ctx({ locale: 'en' }))
      expect(result.action).toBe('collect_information')
      expect(result.suggestedClarification.length).toBeGreaterThan(0)
      expect(result.missingInformation.length).toBeGreaterThan(0)
      expect(result.overallConfidence).toBeLessThan(0.5)
    })
  })

  describe('scoring dimensions', () => {
    it('scores budget comfort time convenience experience weather crowds transport flexibility', () => {
      const result = runTravelStrategyEngine(
        ctx({
          locale: 'en',
          destinationLabel: 'Bali',
          monthHint: 7,
          budgetAmount: 10000,
          durationDays: 8,
          pace: 'relaxed',
          travelerHints: { preferComfort: true },
          destinationPriors: {
            bestSeasons: [4, 5, 6, 7, 8, 9],
            costBand: 'moderate',
            transportationQuality: 55,
            walkingScore: 55,
            recommendedStayDays: { min: 5, ideal: 8, max: 14 },
          },
        }),
      )
      const s = result.primary.scores
      expect(s.budget).toBeGreaterThan(0)
      expect(s.comfort).toBeGreaterThan(0)
      expect(s.time).toBeGreaterThan(0)
      expect(s.convenience).toBeGreaterThan(0)
      expect(s.experience).toBeGreaterThan(0)
      expect(s.weather).toBeGreaterThan(0)
      expect(s.crowds).toBeGreaterThan(0)
      expect(s.transportation).toBeGreaterThan(0)
      expect(s.flexibility).toBeGreaterThan(0)
      expect(s.overallValue).toBeGreaterThan(0)
      expect(s.confidence).toBeGreaterThan(0)
    })
  })

  describe('regression — freeze boundaries', () => {
    it('does not export planTurn; reasoning remains callable', async () => {
      const mod = await import('../agent/travelStrategy')
      expect('planTurn' in mod).toBe(false)
      expect(typeof mod.runTravelStrategyEngine).toBe('function')
      expect(
        runConsultantReasoningPipeline({ locale: 'en', userText: 'timing advice' }).recommendation,
      ).toBeTruthy()
    })
  })
})
