/**
 * Integration Sprint 4 — AI Trip Orchestrator tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID,
  INTEGRATION_TRIP_ORCHESTRATOR_VERSION,
  buildOrchestratorBudget,
  detectTripScenario,
  enrichWithIntegrationTripOrchestrator,
  isIntegrationTripOrchestratorEnabled,
  runTripOrchestrator,
} from '../agent/integrationTripOrchestrator'
import { emptyMemory, emptyRequirements, mergeRequirements, withTripPlan } from '../agent'
import { buildTripPlan } from '../agent/buildItinerary'
import { createFlightSearchEngine, resetDefaultFlightSearchEngine } from '../agent/flightSearchEngine'
import { createHotelSearchEngine, resetDefaultHotelSearchEngine } from '../agent/hotelSearchEngine'
import { resetDefaultProviderRuntimeRegistry } from '../agent/providerRuntime'
import type { AgentMemory } from '../agent/types'

function memory(partial?: Partial<ReturnType<typeof emptyRequirements>>): AgentMemory {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Morocco',
    destinations: ['Morocco'],
    startDate: '2026-08-01',
    endDate: '2026-08-07',
    durationDays: 6,
    travelers: 2,
    budgetAmount: 8000,
    budgetCurrency: 'SAR',
    budgetStyle: 'midrange',
    ...partial,
  })
  const base = emptyMemory('en')
  const plan = buildTripPlan({
    conversationId: 'orch-test',
    requirements,
    locale: 'en',
  })
  return withTripPlan({ ...base, requirements, missingFields: [] }, plan)
}

describe('Integration Sprint 4 — Trip Orchestrator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
    resetDefaultHotelSearchEngine()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultProviderRuntimeRegistry()
    resetDefaultFlightSearchEngine()
    resetDefaultHotelSearchEngine()
    vi.restoreAllMocks()
  })

  it('keeps integration trip orchestrator flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID)).toBe(false)
    expect(isIntegrationTripOrchestratorEnabled()).toBe(false)
    expect(INTEGRATION_TRIP_ORCHESTRATOR_VERSION).toMatch(/integration-trip-orchestrator/)
  })

  it('returns disabled result when flag is OFF', async () => {
    const result = await runTripOrchestrator({ memory: memory() })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('splits budget with buffer and explanations', () => {
    const budget = buildOrchestratorBudget(memory().requirements, 5)
    expect(budget).toBeTruthy()
    expect(budget!.flights + budget!.hotels + budget!.transportation + budget!.activities + budget!.buffer)
      .toBe(budget!.total)
    expect(budget!.explanationEn).toMatch(/buffer/i)
    expect(budget!.explanationAr).toMatch(/احتياطي|ميزان/)
  })

  it('detects scenarios: family, business, luxury, budget, weekend, multi_city', () => {
    expect(detectTripScenario(mergeRequirements(emptyRequirements(), {
      tripPurpose: 'family',
      travelerType: 'family',
    }))).toBe('family')
    expect(detectTripScenario(mergeRequirements(emptyRequirements(), {
      tripPurpose: 'business',
    }))).toBe('business')
    expect(detectTripScenario(mergeRequirements(emptyRequirements(), {
      budgetStyle: 'luxury',
    }))).toBe('luxury')
    expect(detectTripScenario(mergeRequirements(emptyRequirements(), {
      budgetStyle: 'budget',
    }))).toBe('budget')
    expect(detectTripScenario(mergeRequirements(emptyRequirements(), {
      durationDays: 2,
    }))).toBe('weekend')
    expect(detectTripScenario(mergeRequirements(emptyRequirements(), {
      destinations: ['Casablanca', 'Marrakech'],
      destination: 'Casablanca',
      durationDays: 8,
    }))).toBe('multi_city')
  })

  it('asks only for missing destination (incomplete)', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID, true)
    const result = await runTripOrchestrator({
      memory: memory({ destination: null, destinations: [] }),
      deps: { enabled: true },
    })
    expect(result.enabled).toBe(true)
    expect(result.incomplete).toBe(true)
    expect(result.missingFields).toContain('destination')
    expect(result.consultantSummaryEn).toMatch(/where/i)
  })

  it('runs parallel flight + hotel search and builds full recommendation', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID, true)
    const runFlights = vi.fn(async () => ({
      data: {
        offers: [{
          id: 'f1',
          airline: 'SV',
          from: 'RUH',
          to: 'CMN',
          price: 1800,
          currency: 'SAR',
          score: 0.9,
          stops: 0,
          why: 'Non-stop and competitive price',
          whyAr: 'مباشرة وسعر مناسب',
        }],
        usedLive: false,
      },
      empty: false,
    }))
    const runHotels = vi.fn(async () => ({
      data: {
        stays: [{
          name: 'Casa Business Suites',
          area: 'Center',
          nightly: 550,
          nights: 5,
          total: 2750,
          currency: 'SAR',
          score: 0.88,
          hotelStars: 5,
          why: 'Includes breakfast and free cancellation',
          whyAr: 'يشمل الإفطار وإلغاء مجاني',
        }],
        usedLive: false,
      },
      empty: false,
    }))

    const result = await runTripOrchestrator({
      memory: memory(),
      deps: { enabled: true, runFlights, runHotels },
    })

    expect(result.ok).toBe(true)
    expect(runFlights).toHaveBeenCalledTimes(1)
    expect(runHotels).toHaveBeenCalledTimes(1)
    expect(result.executionPlan.parallelGroups).toContain(1)
    expect(result.recommendation?.flight).toBeTruthy()
    expect(result.recommendation?.hotel).toBeTruthy()
    expect(result.budget?.buffer).toBeGreaterThan(0)
    expect(result.itinerary?.days.length).toBeGreaterThan(1)
    expect(result.consultantSummaryEn).toMatch(/Flight:|Hotel:|Budget:/i)
    expect(result.consultantSummaryAr).not.toMatch(/\{"id"/)
    expect(result.recommendation?.whyComboEn.length).toBeGreaterThan(10)
  })

  it('reuses tool offers without re-searching', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID, true)
    const runFlights = vi.fn()
    const runHotels = vi.fn()
    const result = await runTripOrchestrator({
      memory: memory(),
      deps: {
        enabled: true,
        runFlights,
        runHotels,
        flightOffers: [{ id: 'f', airline: 'EK', price: 2000, currency: 'SAR', score: 1, from: 'RUH', to: 'CMN' }],
        hotelStays: [{ name: 'Hotel X', nightly: 400, total: 2000, currency: 'SAR', score: 1, area: 'Marina' }],
      },
    })
    expect(result.ok).toBe(true)
    expect(runFlights).not.toHaveBeenCalled()
    expect(runHotels).not.toHaveBeenCalled()
  })

  it('skips hotels for flights_only package scope', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID, true)
    const runHotels = vi.fn()
    const result = await runTripOrchestrator({
      memory: memory({ packageScope: 'flights_only' }),
      deps: {
        enabled: true,
        runHotels,
        runFlights: async () => ({
          data: { offers: [{ id: 'f', airline: 'SV', price: 1500, currency: 'SAR', score: 1 }], usedLive: false },
          empty: false,
        }),
      },
    })
    expect(result.executionPlan.steps.find((s) => s.id === 'search_hotels')?.status).toBe('skipped')
    expect(runHotels).not.toHaveBeenCalled()
    expect(result.recommendation?.flight).toBeTruthy()
  })

  it('enrich attaches recommendation, budget breakdown, and summary to TripPlan', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID, true)
    const mem = memory()
    const { tripPlan, tripOrchestrator } = await enrichWithIntegrationTripOrchestrator({
      memory: mem,
      tripPlan: mem.tripPlan!,
      enabled: true,
      flightOffers: [{
        id: 'f1', airline: 'SV', from: 'RUH', to: 'CMN', price: 1600, currency: 'SAR', score: 0.9, stops: 0,
        why: 'Best value non-stop',
      }],
      hotelStays: [{
        name: 'Atlas Stay', area: 'Center', nightly: 480, nights: 5, total: 2400, currency: 'SAR', score: 0.9,
        hotelStars: 4, why: 'Central with breakfast',
      }],
    })
    expect(tripOrchestrator?.ok).toBe(true)
    expect(tripPlan.flights[0]?.airline).toBe('SV')
    expect(tripPlan.accommodations[0]?.name).toBe('Atlas Stay')
    expect(tripPlan.estimatedBudget.breakdown.some((b) => b.label === 'Buffer')).toBe(true)
    expect(tripPlan.notes.some((n) => n.includes('Trip orchestrator'))).toBe(true)
  })

  it('enrich is a no-op when flag OFF', async () => {
    const mem = memory()
    const before = mem.tripPlan!
    const { tripPlan, tripOrchestrator } = await enrichWithIntegrationTripOrchestrator({
      memory: mem,
      tripPlan: before,
    })
    expect(tripOrchestrator).toBeNull()
    expect(tripPlan).toBe(before)
  })

  it('flags flight/hotel unavailability conflicts', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID, true)
    const result = await runTripOrchestrator({
      memory: memory(),
      deps: {
        enabled: true,
        runFlights: async () => ({ data: { offers: [], usedLive: false }, empty: true }),
        runHotels: async () => ({ data: { stays: [], usedLive: false }, empty: true }),
      },
    })
    expect(result.conflicts.some((c) => c.code === 'flights_unavailable')).toBe(true)
    expect(result.conflicts.some((c) => c.code === 'hotels_unavailable')).toBe(true)
  })

  it('mock engines remain available for orchestrator fallback path', async () => {
    // Smoke: engines used by orchestrator default deps construct cleanly.
    expect(createFlightSearchEngine({ forceMock: true }).version).toBeTruthy()
    expect(createHotelSearchEngine({ forceMock: true }).version).toBeTruthy()
  })
})
