/**
 * Integration Sprint 8 — Maps & Live Mobility tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_MAPS_MOBILITY_FEATURE_ID,
  INTEGRATION_MAPS_MOBILITY_VERSION,
  createLiveGoogleMapsProvider,
  createMockMapProvider,
  detectMapsMobilityIntent,
  enrichWithIntegrationMapsMobility,
  extractRouteEndpoints,
  isIntegrationMapsLiveEnabled,
  isIntegrationMapsMobilityEnabled,
  runMapsMobility,
} from '../agent/integrationMapsMobility'
import { emptyMemory, emptyRequirements, mergeRequirements, withTripPlan } from '../agent'
import { buildTripPlan } from '../agent/buildItinerary'
import type { AgentMemory } from '../agent/types'

function memoryWithPlan(): AgentMemory {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Casablanca',
    destinations: ['Casablanca'],
    startDate: '2026-08-01',
    endDate: '2026-08-06',
    durationDays: 5,
    travelers: 2,
    budgetAmount: 8000,
    budgetCurrency: 'SAR',
  })
  const base = emptyMemory('en')
  const plan = buildTripPlan({
    conversationId: 'maps-test',
    requirements,
    locale: 'en',
  })
  plan.accommodations = [{
    name: 'Casa Business Suites',
    area: 'Maarif',
    category: 'hotel',
    fit: 'Central',
    estimatedNightly: 500,
    currency: 'SAR',
  }]
  plan.flights = [{
    from: 'RUH',
    to: 'CMN',
    airline: 'SV',
    stops: 0,
    estimatedCost: 1800,
    currency: 'SAR',
    notes: null,
  }]
  return withTripPlan({ ...base, requirements, missingFields: [] }, plan)
}

describe('Integration Sprint 8 — Maps & Live Mobility', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps maps mobility flag OFF by default and live maps never auto-on', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_MAPS_MOBILITY_FEATURE_ID)).toBe(false)
    expect(isIntegrationMapsMobilityEnabled()).toBe(false)
    expect(isIntegrationMapsLiveEnabled()).toBe(false)
    expect(INTEGRATION_MAPS_MOBILITY_VERSION).toMatch(/integration-maps-mobility/)
  })

  it('returns disabled result when flag is OFF', async () => {
    const result = await runMapsMobility({
      memory: memoryWithPlan(),
      userText: 'How do I get to the airport?',
    })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('map provider abstraction geocodes and reverse-geocodes via mock', async () => {
    const provider = createMockMapProvider()
    const places = await provider.geocode('Casablanca')
    expect(places[0]?.coordinates).toBeTruthy()
    const rev = await provider.reverseGeocode(places[0]!.coordinates!)
    expect(rev[0]?.labelEn).toBeTruthy()
    expect(provider.live).toBe(false)
  })

  it('builds route with ETA / leave-by and mobility modes', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_MAPS_MOBILITY_FEATURE_ID, true)
    expect(detectMapsMobilityIntent('How do I get to the airport?')).toBe('how_to_get_there')
    expect(extractRouteEndpoints('from hotel to Hassan II Mosque')).toEqual({
      from: 'hotel',
      to: 'Hassan II Mosque',
    })

    const result = await runMapsMobility({
      memory: memoryWithPlan(),
      userText: 'How do I get to the airport by transit?',
      deps: {
        enabled: true,
        arriveByIso: '2026-08-06T11:00:00.000Z',
      },
    })
    expect(result.enabled).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.live).toBe(false)
    expect(result.route).toBeTruthy()
    expect(result.route!.durationMinutes).toBeGreaterThan(0)
    expect(result.route!.leaveByIso).toBeTruthy()
    expect(result.alternatives.length).toBeGreaterThan(0)
    expect(result.consultantSummaryEn).toMatch(/Route|km|min/i)
  })

  it('answers where am I using trip/hotel spatial context', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_MAPS_MOBILITY_FEATURE_ID, true)
    const result = await runMapsMobility({
      memory: memoryWithPlan(),
      userText: 'Where am I?',
      deps: { enabled: true },
    })
    expect(result.intent).toBe('where_am_i')
    expect(result.origin?.labelEn).toMatch(/Casa|Casablanca/i)
    expect(result.consultantSummaryEn).toMatch(/around|in/i)
  })

  it('suggests nearby places from mock catalog', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_MAPS_MOBILITY_FEATURE_ID, true)
    const result = await runMapsMobility({
      memory: memoryWithPlan(),
      userText: 'Suggest something nearby',
      deps: { enabled: true },
    })
    expect(result.intent).toBe('nearby')
    expect(result.nearby.length).toBeGreaterThan(0)
    expect(result.nearby[0]!.distanceMeters).toBeGreaterThan(0)
  })

  it('live adapter falls back to mock when no client credentials', async () => {
    const live = createLiveGoogleMapsProvider(null)
    expect(live.live).toBe(true)
    const places = await live.geocode('Dubai Marina')
    expect(places.length).toBeGreaterThan(0)
    expect(places[0]?.source === 'mock' || places[0]?.coordinates).toBeTruthy()
  })

  it('soft-enriches trip notes with route summary when flag ON', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_MAPS_MOBILITY_FEATURE_ID, true)
    const memory = memoryWithPlan()
    const enriched = await enrichWithIntegrationMapsMobility({
      memory,
      userText: 'How do I get from Casa Business Suites to Mohammed V Airport?',
      force: true,
      deps: { enabled: true },
    })
    expect(enriched.mapsMobility?.ok).toBe(true)
    expect(enriched.reply).toMatch(/Route|مسار|km|كم/i)
    expect(enriched.tripPlan?.notes.some((n) => /Maps mobility|تنقل الخرائط/i.test(n))).toBe(true)
  })

  it('regression: enrich is a no-op when flag OFF', async () => {
    const memory = memoryWithPlan()
    const enriched = await enrichWithIntegrationMapsMobility({
      memory,
      userText: 'Where am I?',
    })
    expect(enriched.mapsMobility).toBeNull()
    expect(enriched.memory).toBe(memory)
  })
})
