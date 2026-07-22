/**
 * Sprint 112 — AI Memory & Personalization Engine tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  SPRINT112_MEMORY_ENGINE_VERSION,
  MEMORY_ENGINE_FEATURE_ID,
  isMemoryEngineEnabled,
  runMemoryEngine,
  resetMemoryEngineStores,
  extractPreferencesFromText,
  emptyMemoryTravelerProfile,
  applyPreferenceSignals,
  mergeProfiles,
  generateTravelHistory,
  resolvePreferences,
  getOrCreateMemoryProfile,
  getPreferenceStore,
  getOrCreateConversationMemory,
  recordSearch,
  recordRecommendationOutcome,
  getConversationMemoryStore,
  toConciergeMemoryHints,
  type MemoryCandidate,
} from '../agent/memory/index'

const candidates: MemoryCandidate[] = [
  {
    id: 'c_qatar',
    title: 'Qatar balanced',
    price: 11000,
    currency: 'SAR',
    airline: 'Qatar Airways',
    hotelName: 'Marriott Downtown',
    hotelStars: 4,
    hotelChain: 'Marriott',
    cabin: 'economy',
    stops: 0,
    durationMinutes: 200,
    destination: 'DXB',
    country: 'AE',
    departureAirport: 'RUH',
    arrivalAirport: 'DXB',
    layoverMinutes: 0,
    departureHour: 9,
    seatType: 'window',
    meal: 'halal',
    amenities: ['WIFI', 'POOL'],
  },
  {
    id: 'c_cheap',
    title: 'Budget alternate',
    price: 7000,
    currency: 'SAR',
    airline: 'Flynas',
    hotelName: 'Budget Inn',
    hotelStars: 2,
    hotelChain: null,
    cabin: 'economy',
    stops: 1,
    durationMinutes: 360,
    destination: 'DXB',
    country: 'AE',
    departureAirport: 'RUH',
    arrivalAirport: 'DXB',
    layoverMinutes: 180,
    departureHour: 22,
    seatType: null,
    meal: null,
    amenities: ['WIFI'],
  },
]

describe('Sprint 112 — AI Memory Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT112_MEMORY_ENGINE_VERSION).toMatch(/memory-engine/)
    expect(MEMORY_ENGINE_FEATURE_ID).toBe('ai.memory_engine')
    expect(getFeatureRegistry().isEnabled('ai.memory_engine')).toBe(false)
    expect(isMemoryEngineEnabled()).toBe(false)
  })

  describe('feature flag OFF/ON', () => {
    it('OFF returns disabled result', () => {
      const result = runMemoryEngine({
        userId: 'u1',
        messages: [{ text: 'I always fly Qatar Airways.' }],
      })
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.profile).toBeNull()
      expect(result.logs).toContain('memory_engine_disabled')
    })

    it('ON extracts and persists preferences', () => {
      const result = runMemoryEngine(
        {
          userId: 'u1',
          conversationId: 'c1',
          messages: [
            {
              role: 'user',
              text: 'I always fly Qatar Airways. I prefer Marriott. My budget is around 12000 SAR.',
            },
          ],
          candidates,
        },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.profile).not.toBeNull()
      expect(result.extracted.length).toBeGreaterThan(0)
      expect(
        result.profile!.preferredAirlines.some((a) =>
          /qatar/i.test(a.value),
        ),
      ).toBe(true)
      expect(
        result.profile!.preferredHotelChains.some((h) =>
          /marriott/i.test(h.value),
        ),
      ).toBe(true)
      expect(result.profile!.budgetRange?.typical).toBe(12000)
    })
  })

  describe('profile creation', () => {
    it('creates an empty structured profile', () => {
      const profile = emptyMemoryTravelerProfile('u_new')
      expect(profile.userId).toBe('u_new')
      expect(profile.preferredAirlines).toEqual([])
      expect(profile.isFamilyTraveler).toBe(false)
      expect(getOrCreateMemoryProfile('u_new').userId).toBe('u_new')
    })
  })

  describe('preference extraction', () => {
    it('extracts airline, layover avoidance, budget, and family signals', () => {
      const a = extractPreferencesFromText('I always fly Qatar Airways.')
      expect(a.some((s) => s.key === 'preferredAirlines')).toBe(true)

      const b = extractPreferencesFromText("I don't like long layovers.")
      expect(b.some((s) => s.key === 'preferredLayoverMinutes')).toBe(true)

      const c = extractPreferencesFromText('I prefer Marriott.')
      expect(c.some((s) => s.key === 'preferredHotelChains')).toBe(true)

      const d = extractPreferencesFromText('My budget is around 12,000 SAR.')
      expect(d.some((s) => s.key === 'budgetRange' && s.value === 12000)).toBe(
        true,
      )

      const e = extractPreferencesFromText('I usually travel with my wife.')
      expect(
        e.some((s) => s.key === 'travelStyles' && s.value === 'family'),
      ).toBe(true)
    })
  })

  describe('preference updates and merge', () => {
    it('updates confidence on repeated observations', () => {
      let profile = emptyMemoryTravelerProfile('u2')
      profile = applyPreferenceSignals(profile, [
        {
          key: 'preferredAirlines',
          value: 'Emirates',
          polarity: 'prefer',
          confidence: 0.7,
          raw: 't1',
        },
      ])
      const first = profile.preferredAirlines[0]!.confidence
      profile = applyPreferenceSignals(profile, [
        {
          key: 'preferredAirlines',
          value: 'Emirates',
          polarity: 'prefer',
          confidence: 0.7,
          raw: 't2',
        },
      ])
      expect(profile.preferredAirlines[0]!.observations).toBe(2)
      expect(profile.preferredAirlines[0]!.confidence).toBeGreaterThanOrEqual(
        first,
      )
    })

    it('merges two profiles', () => {
      const base = applyPreferenceSignals(emptyMemoryTravelerProfile('u3'), [
        {
          key: 'preferredAirlines',
          value: 'Saudia',
          polarity: 'prefer',
          confidence: 0.6,
          raw: 'a',
        },
      ])
      const incoming = applyPreferenceSignals(emptyMemoryTravelerProfile('u3'), [
        {
          key: 'preferredHotelChains',
          value: 'Hilton',
          polarity: 'prefer',
          confidence: 0.6,
          raw: 'b',
        },
      ])
      const merged = mergeProfiles(base, incoming)
      expect(merged.preferredAirlines.some((a) => a.value === 'Saudia')).toBe(
        true,
      )
      expect(merged.preferredHotelChains.some((h) => h.value === 'Hilton')).toBe(
        true,
      )
    })
  })

  describe('history generation and memory lookup', () => {
    it('builds travel history from searches and acceptances', () => {
      runMemoryEngine(
        {
          userId: 'u4',
          conversationId: 'cA',
          messages: [{ text: 'I always fly Qatar Airways.' }],
          search: {
            origin: 'RUH',
            destination: 'DXB',
            departureDate: '2026-09-01',
            returnDate: '2026-09-05',
            budget: 10000,
            currency: 'SAR',
          },
          recommendationOutcomes: [
            {
              optionId: 'c_qatar',
              title: 'Qatar trip',
              price: 11000,
              currency: 'SAR',
              airline: 'Qatar Airways',
              hotelName: 'Marriott Downtown',
              destination: 'DXB',
              outcome: 'accepted',
            },
          ],
        },
        { enabled: true },
      )

      const memory = getOrCreateConversationMemory('u4')
      expect(memory.recentSearches.length).toBeGreaterThan(0)
      expect(memory.acceptedItineraries.length).toBe(1)
      expect(memory.conversationIds).toContain('cA')

      const history = generateTravelHistory({
        profile: getPreferenceStore().get('u4'),
        conversationMemory: memory,
      })
      expect(history.favoriteCity).toBe('DXB')
      expect(history.favoriteAirline).toMatch(/Qatar/i)
      expect(history.tripCount).toBeGreaterThan(0)
    })

    it('supports multiple conversations for one user', () => {
      runMemoryEngine(
        {
          userId: 'u5',
          conversationId: 'c1',
          messages: [{ text: 'I prefer Hilton.' }],
          search: {
            origin: 'RUH',
            destination: 'CAI',
            departureDate: null,
            returnDate: null,
            budget: null,
            currency: 'SAR',
          },
        },
        { enabled: true },
      )
      runMemoryEngine(
        {
          userId: 'u5',
          conversationId: 'c2',
          messages: [{ text: 'I always fly Saudia.' }],
          search: {
            origin: 'RUH',
            destination: 'JED',
            departureDate: null,
            returnDate: null,
            budget: null,
            currency: 'SAR',
          },
        },
        { enabled: true },
      )
      const memory = getConversationMemoryStore().get('u5')!
      expect(memory.conversationIds).toEqual(expect.arrayContaining(['c1', 'c2']))
      expect(memory.previousDestinations.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('resolver priority and scoring', () => {
    it('lets explicit requests override stored preferences', () => {
      const profile = applyPreferenceSignals(emptyMemoryTravelerProfile('u6'), [
        {
          key: 'preferredAirlines',
          value: 'Qatar Airways',
          polarity: 'prefer',
          confidence: 0.9,
          raw: 'x',
        },
      ])
      const resolution = resolvePreferences({
        profile,
        explicit: { airline: 'Emirates' },
      })
      expect(resolution.effective.airlines).toEqual(['Emirates'])
      expect(resolution.ignoredPreferences).toContain('preferredAirlines')
      expect(resolution.overridesApplied).toContain('airline')
    })

    it('scores candidates with preference match', () => {
      const result = runMemoryEngine(
        {
          userId: 'u7',
          messages: [
            {
              text: 'I always fly Qatar Airways. I prefer Marriott. My budget is around 12000 SAR.',
            },
          ],
          candidates,
        },
        { enabled: true },
      )
      expect(result.scores.length).toBe(2)
      expect(result.scores[0]?.candidateId).toBe('c_qatar')
      expect(result.conciergeHints.some((h) => /previous travel preferences/i.test(h))).toBe(
        true,
      )
      expect(toConciergeMemoryHints(result.metadata).length).toBeGreaterThan(0)
    })
  })

  describe('empty / invalid', () => {
    it('handles empty conversations', () => {
      const result = runMemoryEngine(
        { userId: 'u8', messages: [], candidates: [] },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.ok).toBe(true)
      expect(result.extracted).toEqual([])
    })

    it('rejects missing userId as invalid memory', () => {
      const result = runMemoryEngine(
        { userId: '  ', messages: [{ text: 'hello' }] },
        { enabled: true },
      )
      expect(result.ok).toBe(false)
      expect(result.validationErrors).toContain('userId is required')
    })
  })

  describe('manual conversation memory helpers', () => {
    it('records search and rejection outcomes', () => {
      let state = getOrCreateConversationMemory('u9')
      state = recordSearch(state, {
        conversationId: 'cx',
        origin: 'RUH',
        destination: 'DXB',
        departureDate: '2026-10-01',
        returnDate: '2026-10-04',
        budget: 9000,
        currency: 'SAR',
      })
      state = recordRecommendationOutcome(state, {
        conversationId: 'cx',
        optionId: 'rej1',
        title: 'Rejected',
        price: 5000,
        currency: 'SAR',
        airline: 'Flynas',
        hotelName: null,
        destination: 'DXB',
        outcome: 'rejected',
      })
      getConversationMemoryStore().save(state)
      const loaded = getOrCreateConversationMemory('u9')
      expect(loaded.rejectedItineraries[0]?.optionId).toBe('rej1')
      expect(loaded.recentSearches[0]?.destination).toBe('DXB')
    })
  })
})
