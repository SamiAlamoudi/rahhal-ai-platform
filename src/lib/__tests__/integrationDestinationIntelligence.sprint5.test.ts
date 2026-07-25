/**
 * Integration Sprint 5 — Destination Intelligence Engine tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID,
  INTEGRATION_DESTINATION_INTELLIGENCE_VERSION,
  compareDestinations,
  createMockWeatherProvider,
  detectComparisonQuery,
  enrichWithIntegrationDestinationIntelligence,
  estimateDestinationCost,
  findKnowledgeByName,
  isIntegrationDestinationIntelligenceEnabled,
  isOpenEndedDestinationAsk,
  recommendDestinations,
  runDestinationIntelligence,
  scoreDestination,
  themesFromRequirements,
} from '../agent/integrationDestinationIntelligence'
import { emptyMemory, emptyRequirements, mergeRequirements } from '../agent'
import { createMockLocalTransportProvider } from '../agent/integrationDestinationIntelligence/transport'

describe('Integration Sprint 5 — Destination Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps integration destination intelligence flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID)).toBe(false)
    expect(isIntegrationDestinationIntelligenceEnabled()).toBe(false)
    expect(INTEGRATION_DESTINATION_INTELLIGENCE_VERSION).toMatch(/integration-destination-intelligence/)
  })

  it('returns disabled result when flag is OFF', async () => {
    const result = await runDestinationIntelligence({
      userText: 'Where should I travel?',
      requirements: emptyRequirements(),
    })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('does not enrich planTurn overlay when flag is OFF', async () => {
    const memory = emptyMemory('en')
    const enriched = await enrichWithIntegrationDestinationIntelligence({
      memory,
      userText: 'Where should I travel?',
    })
    expect(enriched.destinationIntelligence).toBeNull()
    expect(enriched.reply).toBeNull()
  })

  it('recommends destinations for open-ended ask without booking request', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID, true)
    expect(isOpenEndedDestinationAsk('Where should I travel?')).toBe(true)
    const result = await runDestinationIntelligence({
      locale: 'en',
      userText: 'Where should I travel?',
      requirements: mergeRequirements(emptyRequirements(), {
        destinationFlexible: true,
        budgetAmount: 9000,
        budgetCurrency: 'SAR',
        budgetStyle: 'midrange',
        durationDays: 6,
        travelers: 2,
        interests: ['culture', 'food'],
      }),
      deps: { enabled: true },
    })
    expect(result.enabled).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.mode).toBe('recommend')
    expect(result.primary).toBeTruthy()
    expect(result.primary!.score).toBeGreaterThanOrEqual(50)
    expect(result.consultantSummaryEn.length).toBeGreaterThan(20)
    expect(result.consultantSummaryEn).not.toMatch(/encyclopedia|wikipedia/i)
    expect(result.alternatives.length).toBeGreaterThan(0)
  })

  it('compares Casablanca vs Marrakech, Paris vs Rome, Tokyo vs Seoul', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID, true)
    const req = mergeRequirements(emptyRequirements(), {
      durationDays: 5,
      travelers: 2,
      budgetStyle: 'midrange',
    })

    for (const [left, right] of [
      ['Casablanca', 'Marrakech'],
      ['Paris', 'Rome'],
      ['Tokyo', 'Seoul'],
    ] as const) {
      const cmp = await compareDestinations(left, right, req)
      expect(cmp, `${left} vs ${right}`).toBeTruthy()
      expect(cmp!.differencesEn.length).toBeGreaterThan(0)
      expect(cmp!.differencesAr.length).toBeGreaterThan(0)
      expect(cmp!.verdictEn.length).toBeGreaterThan(10)
      expect(cmp!.left.knowledge.id).toBeTruthy()
      expect(cmp!.right.knowledge.id).toBeTruthy()
    }

    const detected = detectComparisonQuery('Casablanca vs Marrakech')
    expect(detected).toEqual({ left: 'Casablanca', right: 'Marrakech' })

    const turn = await runDestinationIntelligence({
      userText: 'Paris vs Rome',
      requirements: req,
      locale: 'en',
      deps: { enabled: true },
    })
    expect(turn.mode).toBe('compare')
    expect(turn.comparison).toBeTruthy()
    expect(turn.ok).toBe(true)
  })

  it('matches budget-conscious travelers to lower local-spend destinations', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID, true)
    const budgetReq = mergeRequirements(emptyRequirements(), {
      budgetAmount: 3500,
      budgetCurrency: 'SAR',
      budgetStyle: 'budget',
      durationDays: 5,
      travelers: 2,
      interests: ['culture'],
    })
    const luxuryReq = mergeRequirements(emptyRequirements(), {
      budgetAmount: 40000,
      budgetCurrency: 'SAR',
      budgetStyle: 'luxury',
      durationDays: 7,
      travelers: 2,
      interests: ['luxury', 'beach'],
    })
    const budgetRecs = await recommendDestinations(budgetReq, 5)
    const luxuryRecs = await recommendDestinations(luxuryReq, 5)
    expect(budgetRecs[0]!.score).toBeGreaterThan(40)
    expect(luxuryRecs.some((r) => r.knowledge.themes.includes('luxury'))).toBe(true)
    const maldives = findKnowledgeByName('Maldives')!
    const istanbul = findKnowledgeByName('Istanbul')!
    const themes = themesFromRequirements({
      interests: ['luxury', 'beach'],
      tripPurpose: null,
      travelerType: null,
      budgetStyle: 'luxury',
      weatherPreference: null,
    })
    expect(scoreDestination(maldives, luxuryReq, themes).score)
      .toBeGreaterThan(scoreDestination(istanbul, luxuryReq, themes).score - 5)
  })

  it('provides weather readiness reasoning from mock provider', async () => {
    const paris = findKnowledgeByName('Paris')!
    const weather = await createMockWeatherProvider().getWeather({
      destination: paris,
      month: paris.seasonality.bestMonths[0],
    })
    expect(weather.source).toBe('mock')
    expect(weather.tempHighC).toBeTypeOf('number')
    expect(weather.readinessEn.length).toBeGreaterThan(5)
    expect(weather.readinessAr.length).toBeGreaterThan(5)

    getFeatureRegistry().setEnabled(INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID, true)
    const result = await runDestinationIntelligence({
      userText: 'Where should I travel?',
      requirements: mergeRequirements(emptyRequirements(), {
        startDate: '2026-04-10',
        durationDays: 5,
        travelers: 2,
        interests: ['culture'],
        destinationFlexible: true,
      }),
      deps: { enabled: true },
    })
    expect(result.primary?.weather.readinessEn).toBeTruthy()
    expect(result.consultantSummaryEn).toMatch(/Weather|weather|months|Best/i)
  })

  it('scores family / business / luxury travel distinctly', async () => {
    const dubai = findKnowledgeByName('Dubai')!
    const casablanca = findKnowledgeByName('Casablanca')!
    const maldives = findKnowledgeByName('Maldives')!

    const familyReq = mergeRequirements(emptyRequirements(), {
      tripPurpose: 'family',
      travelerType: 'family',
      children: 2,
      travelers: 4,
      durationDays: 6,
      budgetStyle: 'midrange',
      startDate: '2026-12-10',
    })
    const businessReq = mergeRequirements(emptyRequirements(), {
      tripPurpose: 'business',
      travelerType: 'business',
      travelers: 1,
      durationDays: 3,
      budgetStyle: 'midrange',
      startDate: '2026-03-10',
    })
    const luxuryReq = mergeRequirements(emptyRequirements(), {
      budgetStyle: 'luxury',
      budgetAmount: 30000,
      travelers: 2,
      durationDays: 6,
      interests: ['luxury', 'beach'],
      startDate: '2026-02-10',
    })

    const familyThemes = themesFromRequirements({
      interests: [],
      tripPurpose: 'family',
      travelerType: 'family',
      budgetStyle: 'midrange',
      weatherPreference: null,
    })
    const businessThemes = themesFromRequirements({
      interests: [],
      tripPurpose: 'business',
      travelerType: 'business',
      budgetStyle: 'midrange',
      weatherPreference: null,
    })
    const luxuryThemes = themesFromRequirements({
      interests: ['luxury', 'beach'],
      tripPurpose: null,
      travelerType: null,
      budgetStyle: 'luxury',
      weatherPreference: null,
    })

    expect(scoreDestination(dubai, familyReq, familyThemes).score).toBeGreaterThan(70)
    expect(scoreDestination(casablanca, businessReq, businessThemes).score).toBeGreaterThan(70)
    expect(scoreDestination(maldives, luxuryReq, luxuryThemes).score).toBeGreaterThan(70)

    const familyRecs = await recommendDestinations(familyReq, 3)
    expect(familyRecs[0]!.knowledge.themes.some((t) => t === 'family' || t === 'beach' || t === 'culture')).toBe(true)
  })

  it('estimates local cost and transport options', async () => {
    const rome = findKnowledgeByName('Rome')!
    const cost = estimateDestinationCost(
      rome,
      mergeRequirements(emptyRequirements(), {
        durationDays: 6,
        travelers: 2,
        budgetStyle: 'midrange',
      }),
    )
    expect(cost.mealsPerDay).toBeGreaterThan(0)
    expect(cost.transportPerDay).toBeGreaterThan(0)
    expect(cost.activitiesPerDay).toBeGreaterThan(0)
    expect(cost.dailyTotal).toBe(cost.mealsPerDay + cost.transportPerDay + cost.activitiesPerDay)
    expect(cost.tripTotal).toBeGreaterThan(cost.dailyTotal)

    const transport = await createMockLocalTransportProvider().getOptions(rome)
    expect(transport.map((t) => t.mode)).toEqual(
      expect.arrayContaining(['airport_transfer', 'metro', 'taxi', 'rideshare', 'walking']),
    )
  })

  it('includes culture guidance (dress, safety, language, etiquette, weekends)', () => {
    const tokyo = findKnowledgeByName('Tokyo')!
    expect(tokyo.culture.language).toBeTruthy()
    expect(tokyo.culture.currency).toBeTruthy()
    expect(tokyo.culture.dressCodeEn).toBeTruthy()
    expect(tokyo.culture.safetyAr).toBeTruthy()
    expect(tokyo.culture.etiquetteEn).toBeTruthy()
    expect(tokyo.culture.businessCustomsEn).toBeTruthy()
    expect(tokyo.culture.weekendDays).toBeTruthy()
    expect(tokyo.kind === 'city' || tokyo.kind === 'region').toBe(true)
    expect(tokyo.neighborhoods.length).toBeGreaterThan(0)
    expect(tokyo.seasonality.bestMonths.length).toBeGreaterThan(0)
  })

  it('soft-enriches memory with suggested destinations when flag ON', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID, true)
    const memory = {
      ...emptyMemory('ar'),
      requirements: mergeRequirements(emptyRequirements(), {
        destinationFlexible: true,
        interests: ['beach'],
        budgetStyle: 'luxury',
        durationDays: 5,
        travelers: 2,
      }),
    }
    const enriched = await enrichWithIntegrationDestinationIntelligence({
      memory,
      userText: 'أين أسافر؟',
      force: true,
      deps: { enabled: true },
    })
    expect(enriched.destinationIntelligence?.ok).toBe(true)
    expect(enriched.reply).toMatch(/أقترح|بديل|الطقس/)
    expect(enriched.memory.requirements.destinations.length).toBeGreaterThan(0)
  })

  it('regression: knowledge covers cities, countries, regions, neighborhoods', () => {
    const kinds = new Set(
      [
        findKnowledgeByName('Casablanca')!.kind,
        findKnowledgeByName('Maldives')!.kind,
      ],
    )
    expect(kinds.has('city')).toBe(true)
    expect(kinds.has('region')).toBe(true)
    expect(findKnowledgeByName('Casablanca')!.neighborhoods.length).toBeGreaterThan(1)
    expect(findKnowledgeByName('Paris')!.country).toBeTruthy()
    expect(findKnowledgeByName('Dubai')!.region).toBeTruthy()
  })
})
