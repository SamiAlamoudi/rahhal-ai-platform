/**
 * Integration Sprint 9 — Budget & Pricing Intelligence tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_BUDGET_PRICING_FEATURE_ID,
  INTEGRATION_BUDGET_PRICING_VERSION,
  buildBudgetTradeoffs,
  buildFlexibleAlternatives,
  createBudgetEngine,
  detectBudgetPricingIntent,
  enrichWithIntegrationBudgetPricing,
  isIntegrationBudgetPricingEnabled,
  optimizeBudgetOptions,
  resetCostMemoryForTests,
  runBudgetPricing,
} from '../agent/integrationBudgetPricing'
import { emptyMemory, emptyRequirements, mergeRequirements, withTripPlan } from '../agent'
import { buildTripPlan } from '../agent/buildItinerary'
import type { AgentMemory } from '../agent/types'

function memoryWithBudget(amount = 6000): AgentMemory {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Casablanca',
    destinations: ['Casablanca'],
    startDate: '2026-08-01',
    endDate: '2026-08-06',
    durationDays: 5,
    travelers: 2,
    budgetAmount: amount,
    budgetCurrency: 'SAR',
    budgetStyle: 'midrange',
  })
  const base = emptyMemory('en')
  const plan = buildTripPlan({
    conversationId: 'budget-pricing-test',
    requirements,
    locale: 'en',
  })
  plan.flights = [{
    from: 'RUH',
    to: 'CMN',
    airline: 'SV',
    stops: 0,
    estimatedCost: 1800,
    currency: 'SAR',
    notes: null,
  }]
  plan.accommodations = [{
    name: 'Casa Business Suites',
    area: 'Center',
    category: 'hotel',
    fit: 'Central',
    estimatedNightly: 450,
    currency: 'SAR',
  }]
  return withTripPlan({ ...base, requirements, missingFields: [] }, plan)
}

describe('Integration Sprint 9 — Budget & Pricing Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetCostMemoryForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetCostMemoryForTests()
  })

  it('keeps integration budget pricing flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_BUDGET_PRICING_FEATURE_ID)).toBe(false)
    expect(isIntegrationBudgetPricingEnabled()).toBe(false)
    expect(INTEGRATION_BUDGET_PRICING_VERSION).toMatch(/integration-budget-pricing/)
  })

  it('returns disabled when flag is OFF', async () => {
    const result = await runBudgetPricing({
      memory: memoryWithBudget(),
      userText: 'I have SAR 6000.',
    })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('BudgetEngine supports total / per traveler / per day / reserve', () => {
    const engine = createBudgetEngine()
    const envelope = engine.buildEnvelope({
      total: 6000,
      currency: 'SAR',
      travelers: 2,
      nights: 5,
      reserveRatio: 0.08,
    })
    expect(envelope.emergencyReserve.amount).toBe(480)
    expect(envelope.usable.amount).toBe(5520)
    expect(envelope.perTraveler.amount).toBe(2760)
    expect(envelope.perDay.amount).toBe(1104)
    expect(envelope.total.currency).toBe('SAR')
  })

  it('builds cost breakdown including meals, insurance, taxes', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_BUDGET_PRICING_FEATURE_ID, true)
    const result = await runBudgetPricing({
      memory: memoryWithBudget(6000),
      userText: 'Stay under my budget.',
      deps: {
        enabled: true,
        flightOffers: [{ price: 1600, currency: 'SAR' }],
        hotelStays: [{ nightly: 400, nights: 4, total: 1600, currency: 'SAR' }],
      },
    })
    expect(result.ok).toBe(true)
    expect(result.breakdown).toBeTruthy()
    expect(result.breakdown!.flights).toBeGreaterThan(0)
    expect(result.breakdown!.hotels).toBeGreaterThan(0)
    expect(result.breakdown!.meals).toBeGreaterThan(0)
    expect(result.breakdown!.insurance).toBeGreaterThan(0)
    expect(result.breakdown!.taxes).toBeGreaterThan(0)
    expect(result.breakdown!.estimatedTotal).toBeGreaterThan(result.breakdown!.flights)
  })

  it('explains smart trade-offs', () => {
    const engine = createBudgetEngine()
    const envelope = engine.buildEnvelope({ total: 6000, currency: 'SAR', travelers: 2, nights: 4 })
    const options = optimizeBudgetOptions({ baseEnvelope: envelope, preferredTier: 'balanced' })
    const tradeoffs = buildBudgetTradeoffs({
      breakdown: options[0]!.breakdown,
      primary: options[0]!,
      alternatives: options.slice(1),
      flightHoursSaved: 2,
    })
    expect(tradeoffs.length).toBeGreaterThan(0)
    expect(tradeoffs.some((t) =>
      /saves|exceeds|headroom|trade-off|توفير|تجاوز|هامش|مقايضة/i.test(t.detailEn + t.detailAr),
    )).toBe(true)
  })

  it('optimizer generates Budget / Balanced / Premium / Luxury / Best Value', () => {
    const engine = createBudgetEngine()
    const envelope = engine.buildEnvelope({ total: 8000, currency: 'SAR', travelers: 2, nights: 5 })
    const options = optimizeBudgetOptions({ baseEnvelope: envelope })
    const tiers = new Set(options.map((o) => o.tier))
    expect(tiers.has('budget')).toBe(true)
    expect(tiers.has('balanced')).toBe(true)
    expect(tiers.has('premium')).toBe(true)
    expect(tiers.has('luxury')).toBe(true)
    expect(tiers.has('best_value')).toBe(true)
    expect(options[0]!.score).toBeGreaterThan(0)
  })

  it('recommends flexible alternatives when budget is insufficient', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_BUDGET_PRICING_FEATURE_ID, true)
    const result = await runBudgetPricing({
      memory: memoryWithBudget(2500),
      userText: 'Find something cheaper.',
      deps: {
        enabled: true,
        flightOffers: [{ price: 2200 }],
        hotelStays: [{ total: 1800 }],
      },
    })
    expect(result.flexible.length).toBeGreaterThan(0)
    expect(result.flexible.map((f) => f.kind)).toEqual(
      expect.arrayContaining(['different_dates', 'different_hotel', 'alternative_airline']),
    )
    const flex = buildFlexibleAlternatives({
      breakdown: result.breakdown!,
      destination: 'Casablanca',
      currency: 'SAR',
    })
    expect(flex.some((f) => f.kind === 'alternative_destination')).toBe(true)
  })

  it('supports conversational budget questions and cost memory', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_BUDGET_PRICING_FEATURE_ID, true)
    expect(detectBudgetPricingIntent('I have SAR 6000.')).toBe('set_budget')
    expect(detectBudgetPricingIntent('Stay under my budget.')).toBe('stay_under')
    expect(detectBudgetPricingIntent('Find something cheaper.')).toBe('find_cheaper')
    expect(detectBudgetPricingIntent('Luxury but worth it.')).toBe('luxury_worth_it')

    const result = await runBudgetPricing({
      memory: memoryWithBudget(6000),
      userText: 'I have SAR 6000. Luxury but worth it.',
      deps: { enabled: true, userId: 'traveler-1' },
    })
    expect(result.memory.preferredBudget).toBe(6000)
    expect(result.memory.luxuryPreference).toBe(true)
    expect(result.consultantSummaryEn.length).toBeGreaterThan(20)
  })

  it('soft-enriches trip plan estimated budget when flag ON', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_BUDGET_PRICING_FEATURE_ID, true)
    const memory = memoryWithBudget(7000)
    const enriched = await enrichWithIntegrationBudgetPricing({
      memory,
      userText: 'Stay under my budget.',
      force: true,
      deps: { enabled: true, userId: 't2' },
    })
    expect(enriched.budgetPricing?.ok).toBe(true)
    expect(enriched.tripPlan?.estimatedBudget.breakdown.some((b) => b.label === 'Meals')).toBe(true)
    expect(enriched.reply).toMatch(/Budget|envelope|est\.|أميل|إطار/i)
  })

  it('regression: enrich is a no-op when flag OFF', async () => {
    const memory = memoryWithBudget()
    const enriched = await enrichWithIntegrationBudgetPricing({
      memory,
      userText: 'I have SAR 6000.',
    })
    expect(enriched.budgetPricing).toBeNull()
    expect(enriched.memory).toBe(memory)
  })
})
