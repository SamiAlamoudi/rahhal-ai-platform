/**
 * Sprint 9 Phase 4 — recommendation bridge (Phase AB only).
 */
import { describe, expect, it } from 'vitest'
import { emptyRequirements } from '../agent/types'
import { buildConciergeRecommendations } from '../concierge/recommendationBridge'
import { emptySoftSignals } from '../concierge'
import { createRecommendationEngine } from '../ai'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Concierge Phase 4 — recommendation bridge', () => {
  it('returns three conversational option lines via RecommendationEngine', () => {
    const view = buildConciergeRecommendations({
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Kyoto',
        destinations: ['Kyoto'],
        durationDays: 6,
        budgetAmount: 3500,
        budgetCurrency: 'USD',
        budgetStyle: 'midrange',
        travelers: 2,
        interests: ['culture', 'food'],
      },
      softSignals: {
        ...emptySoftSignals(),
        pace: 'relaxed',
        mustHaves: ['culture', 'food'],
      },
      engine: createRecommendationEngine(),
    })

    expect(view.optionLines.length).toBe(3)
    expect(view.optionLines[0]).toMatch(/Kyoto/i)
    expect(view.overallConfidence).toBeGreaterThan(0)
    expect(view.result.primary).not.toBeNull()
  })

  it('biases comfort-first when pace is relaxed', () => {
    const view = buildConciergeRecommendations({
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Maldives',
        destinations: ['Maldives'],
        budgetStyle: 'luxury',
      },
      softSignals: {
        ...emptySoftSignals(),
        pace: 'relaxed',
        mustHaves: ['beach'],
      },
    })
    expect(view.optionLines[0].toLowerCase()).toMatch(/comfort/)
  })

  it('supports Arabic framing labels', () => {
    const view = buildConciergeRecommendations({
      locale: 'ar',
      requirements: {
        ...emptyRequirements(),
        destination: 'إسطنبول',
        destinations: ['إسطنبول'],
      },
      softSignals: emptySoftSignals(),
    })
    expect(view.optionLines.join('\n')).toMatch(/إسطنبول|راحة|توازن|مرونة/)
  })

  it('source file stays provider-agnostic', () => {
    const src = readFileSync(
      resolve(__dirname, '../concierge/recommendationBridge.ts'),
      'utf8',
    )
    expect(src.toLowerCase()).not.toMatch(
      /amadeus|duffel|travelport|sabre|expedia|booking\.com|aggregat|integrations\//,
    )
    expect(src).toMatch(/createRecommendationEngine|from '\.\.\/ai'/)
  })
})
