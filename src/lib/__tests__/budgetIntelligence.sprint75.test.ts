/**
 * Sprint 75 — Budget Intelligence production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { emptyMemory, emptyRequirements, extractFromUserText } from '../agent'
import {
  allocateBudget,
  computeBudgetScore,
  parseBudgetUtterance,
  rankFlightsByBudget,
  rankHotelsByBudget,
  rankPackagesByBudget,
  runBudgetIntelligence,
  SPRINT75_BUDGET_INTELLIGENCE_VERSION,
} from '../agent/budgetIntelligence'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'b75'): ChatMessage {
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

describe('Sprint 75 — Budget Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('enables ai.budget_intelligence by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.budget_intelligence')).toBe(true)
    expect(SPRINT75_BUDGET_INTELLIGENCE_VERSION).toMatch(/budget/)
  })

  it('parses budget amounts and currencies from conversation', () => {
    expect(parseBudgetUtterance('My budget is SAR 8,000')).toMatchObject({
      amount: 8000,
      currency: 'SAR',
      intent: 'under_cap',
    })
    expect(parseBudgetUtterance('Keep everything under $2,000')).toMatchObject({
      amount: 2000,
      currency: 'USD',
    })
    expect(parseBudgetUtterance('Luxury but under 15,000 SAR')).toMatchObject({
      amount: 15000,
      currency: 'SAR',
      intent: 'luxury',
      style: 'luxury',
    })
    expect(parseBudgetUtterance('Cheapest possible')).toMatchObject({
      intent: 'cheapest',
      style: 'budget',
    })
    expect(parseBudgetUtterance('Business class if within budget of 12000 SAR')).toMatchObject({
      amount: 12000,
      businessIfFits: true,
      currency: 'SAR',
    })
  })

  it('parses min/max ranges', () => {
    const parsed = parseBudgetUtterance('Budget between 5000 and 8000 SAR')
    expect(parsed.minAmount).toBe(5000)
    expect(parsed.maxAmount).toBe(8000)
    expect(parsed.currency).toBe('SAR')
    expect(parsed.intent).toBe('range')
  })

  it('extractRequirements understands SAR budget phrases', () => {
    const extracted = extractFromUserText('Trip to Tokyo, my budget is SAR 8000')
    expect(extracted.patch.budgetAmount).toBe(8000)
    expect(extracted.patch.budgetCurrency).toBe('SAR')
  })

  it('allocates budget across flights, hotels, transportation, activities', () => {
    const allocation = allocateBudget({
      total: 10000,
      currency: 'SAR',
      style: 'midrange',
    })
    expect(allocation.flights + allocation.hotels + allocation.transportation + allocation.activities)
      .toBe(10000)
    expect(allocation.flights).toBeGreaterThan(0)
    expect(allocation.hotels).toBeGreaterThan(0)
    expect(allocation.activities).toBeGreaterThan(0)
  })

  it('computes Budget Score factors', () => {
    const score = computeBudgetScore({
      price: 3000,
      budgetCap: 5000,
      qualityHint: 80,
      durationMinutes: 360,
      intent: 'best_value',
    })
    expect(score.priceFit).toBeGreaterThan(70)
    expect(score.budgetScore).toBeGreaterThan(50)
    expect(score.savings).toBeGreaterThan(40)
  })

  it('ranks flights by budget score (not price alone)', () => {
    const ranked = rankFlightsByBudget([
      {
        id: 'cheap-long',
        title: 'Cheap long',
        price: 900,
        currency: 'SAR',
        durationMinutes: 1200,
        stops: 2,
      },
      {
        id: 'value',
        title: 'Value nonstop',
        price: 1400,
        currency: 'SAR',
        durationMinutes: 480,
        stops: 0,
      },
      {
        id: 'over',
        title: 'Over budget',
        price: 6000,
        currency: 'SAR',
        durationMinutes: 400,
        stops: 0,
      },
    ], { budgetCap: 2000, intent: 'best_value' })

    expect(ranked[0]!.id).not.toBe('over')
    expect(ranked[0]!.score.budgetScore).toBeGreaterThanOrEqual(ranked[1]!.score.budgetScore)
    expect(ranked.find((r) => r.id === 'over')!.score.priceFit).toBeLessThan(40)
  })

  it('ranks hotels by budget score', () => {
    const ranked = rankHotelsByBudget([
      { id: 'h1', title: 'Budget Inn', price: 800, currency: 'SAR', rating: 6, stars: 2 },
      { id: 'h2', title: 'City Comfort', price: 1600, currency: 'SAR', rating: 8.5, stars: 4 },
      { id: 'h3', title: 'Palace', price: 9000, currency: 'SAR', rating: 9.5, stars: 5 },
    ], { budgetCap: 2500, style: 'midrange', intent: 'best_value' })
    expect(ranked.find((r) => r.id === 'h3')!.score.budgetScore)
      .toBeLessThan(ranked.find((r) => r.id === 'h2')!.score.budgetScore)
    expect(ranked[0]!.id).not.toBe('h3')
    expect(ranked[0]!.score.budgetScore).toBeGreaterThanOrEqual(ranked[1]!.score.budgetScore)
  })

  it('ranks combined trip packages', () => {
    const ranked = rankPackagesByBudget([
      { id: 'p1', title: 'A', price: 3500, currency: 'SAR', hotelRating: 8, flightDurationMinutes: 500 },
      { id: 'p2', title: 'B', price: 9000, currency: 'SAR', hotelRating: 9, flightDurationMinutes: 400 },
    ], { budgetCap: 5000, intent: 'under_cap' })
    expect(ranked[0]!.id).toBe('p1')
    expect(ranked[1]!.score.priceFit).toBeLessThan(ranked[0]!.score.priceFit)
  })

  it('detects overflow and underflow diagnostics', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
      durationDays: 5,
      destination: 'Tokyo',
      origin: 'Riyadh',
    }

    const overflow = runBudgetIntelligence({
      memory,
      userText: 'Budget SAR 5000',
      flightOffers: [{ id: 'f', airline: 'SV', from: 'RUH', to: 'HND', price: 4000, currency: 'SAR', stops: 0, durationHours: 10 }],
      hotelStays: [{ id: 'h', name: 'Palace', nightly: 800, total: 3200, currency: 'SAR', rating: 9 }],
    })
    expect(overflow.diagnostics.overflow).toBe(true)
    expect(overflow.diagnostics.remainingBudget).toBeLessThan(0)

    const underflow = runBudgetIntelligence({
      memory,
      userText: 'Budget SAR 5000',
      flightOffers: [{ id: 'f', airline: 'SV', from: 'RUH', to: 'HND', price: 600, currency: 'SAR', stops: 1, durationHours: 12 }],
      hotelStays: [{ id: 'h', name: 'Inn', nightly: 100, total: 400, currency: 'SAR', rating: 6 }],
    })
    expect(underflow.diagnostics.underflow).toBe(true)
    expect(underflow.diagnostics.remainingBudget).toBeGreaterThan(0)
  })

  it('handles missing budget', () => {
    const memory = emptyMemory('en')
    memory.requirements = { ...emptyRequirements(), destination: 'Tokyo', origin: 'Riyadh' }
    const result = runBudgetIntelligence({
      memory,
      userText: 'I want to go to Tokyo',
      flightOffers: [{ id: 'f', airline: 'SV', from: 'RUH', to: 'HND', price: 1000, currency: 'SAR' }],
      hotelStays: [],
    })
    expect(result.diagnostics.missingBudget).toBe(true)
    expect(result.diagnostics.budgetDetected).toBe(false)
    expect(result.allocation).toBeNull()
    expect(result.recommendationFacts.some((f) => /Budget not detected/i.test(f))).toBe(true)
  })

  it('planTurn attaches budgetIntelligence meta for budgeted Tokyo trip', async () => {
    const service = createTravelAgentService({
      concierge: false,
      autonomousAgentEnabled: true,
      bookingIntelligenceEnabled: true,
      budgetIntelligenceEnabled: true,
    })
    const conversationId = 'sprint75-tokyo-budget'
    const turn = await service.planTurn({
      conversationId,
      messages: [msg(
        'I want a solo trip to Tokyo for 6 days in September from Riyadh, my budget is SAR 8000',
        conversationId,
      )],
    })
    expect(turn.meta.budgetIntelligence?.budgetDetected).toBe(true)
    expect(turn.meta.budgetIntelligence?.currency).toBe('SAR')
    expect(turn.meta.budgetIntelligence?.amount).toBe(8000)
    expect(turn.meta.budgetIntelligence?.allocatedFlights).toBeGreaterThan(0)
    expect(turn.meta.budgetIntelligence?.allocatedHotels).toBeGreaterThan(0)
  })
})
