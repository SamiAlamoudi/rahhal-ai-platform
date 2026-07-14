import { describe, it, expect } from 'vitest'
import {
  orchestrateMockSearch,
  MOCK_PROVIDERS,
  normalizeProviderResult,
  deduplicateResults,
  type ProviderSearchResult,
} from '../searchOrchestrator'
import { buildTravelSearchRequest } from '../travelSearchRequest'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  confirmDecisionProfile,
} from '../travelSession'
import { getActiveProviders, createDefaultRegistry } from '../providers'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

function makeRequest() {
  let s = mergeTravelSession(createEmptyTravelSession(), MSG1)
  s = mergeTravelSession(s, 'من الرياض')
  s = mergeTravelSession(s, '15 أكتوبر')
  s = confirmDecisionProfile(s)
  return buildTravelSearchRequest(s)
}

describe('Scenario 8: Orchestrator', () => {
  it('uses the provider registry (default registry returns enabled providers)', () => {
    const registry = createDefaultRegistry()
    const providers = registry.listProviders({ enabledOnly: true })
    expect(providers.length).toBeGreaterThan(0)
  })

  it('getActiveProviders returns sorted, enabled providers', () => {
    const active = getActiveProviders()
    expect(active.length).toBeGreaterThan(0)
    for (const p of active) {
      expect(p.enabled).toBe(true)
    }
  })

  it('skips disabled providers', () => {
    const req = makeRequest()
    const allDisabled = MOCK_PROVIDERS.map(p => ({ ...p, enabled: false }))
    const result = orchestrateMockSearch(req, allDisabled)
    expect(result.providersQueried).toBe(0)
    expect(result.rankedOptions.length).toBe(0)
  })

  it('normalizes mock results into NormalizedTravelOption', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    expect(result.rankedOptions.length).toBeGreaterThan(0)
    for (const opt of result.rankedOptions) {
      expect(opt.id).toBeTruthy()
      expect(opt.type).toMatch(/^(flight|hotel|activity|transportation)$/)
      expect(opt.decisionScore).not.toBeNull()
      expect(opt.recommendationLevel).not.toBeNull()
    }
  })

  it('removes duplicates', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    const fingerprints = new Set(result.rankedOptions.map(o =>
      [o.type, o.title, o.price, o.currency].join('|')
    ))
    expect(fingerprints.size).toBe(result.rankedOptions.length)
  })

  it('ranks results using the scoring engine (descending score)', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    const scores = result.rankedOptions.map(o => o.decisionScore?.weightedAverage ?? 0)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  it('makes no external request (all results are mock data)', () => {
    const req = makeRequest()
    const result = orchestrateMockSearch(req, MOCK_PROVIDERS)
    expect(result.errors.length).toBe(0)
    expect(result.providersSucceeded).toBe(result.providersQueried)
  })

  it('deduplicateResults removes exact flight duplicates', () => {
    const mockRaw: ProviderSearchResult = {
      providerId: 'test',
      providerName: 'Test',
      providerType: 'flight',
      externalId: 'TEST-1',
      title: 'Test Flight',
      description: '',
      currency: 'SAR',
      price: 1000,
      originalPrice: null,
      durationMinutes: 600,
      stops: 0,
      rating: 4.5,
      location: 'Test',
      cancellationPolicy: null,
      baggageIncluded: true,
      familyFriendly: true,
      rawMetadata: { airline: 'Test', flightNumber: 'T1', origin: 'RUH', destination: 'NRT', departureTime: '2026-10-15T08:00' },
      retrievedAt: new Date().toISOString(),
    }
    const opt1 = normalizeProviderResult(mockRaw)
    const opt2 = normalizeProviderResult(mockRaw)
    const { unique, removedCount } = deduplicateResults([opt1, opt2])
    expect(unique.length).toBe(1)
    expect(removedCount).toBe(1)
  })
})
