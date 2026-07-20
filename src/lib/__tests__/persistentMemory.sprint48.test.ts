/**
 * Sprint 48 — Persistent preference memory tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
  emptyPersonalizationProfile,
  createPreferenceEngine,
  resetPreferenceEngine,
  getPreferenceEngine,
} from '../ai'
import {
  createMemoryPreferenceStorage,
  createLocalStoragePreferenceStorage,
} from '../ai/preferences/preferenceStorage'
import {
  learnPreferencesFromRequirements,
  seedRequirementsFromPreferences,
} from '../agent/reasoning/preferenceBridge'
import { mergeRequirements } from '../agent/memory'
import { emptyRequirements } from '../agent/types'

describe('Sprint 48 persistent preference memory', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('enables ai.persistent_memory by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.persistent_memory')).toBe(true)
  })

  it('survives engine reset when backed by storage', () => {
    const storage = createMemoryPreferenceStorage()
    const first = createPreferenceEngine({ storage })
    const profile = emptyPersonalizationProfile('user-48')
    profile.budget.typicalTripBudget = 12000
    profile.budget.currency = 'SAR'
    profile.travelStyle.weatherPreference = 'cold'
    profile.travelStyle.favoriteDestinations = ['Switzerland']
    first.upsertProfile(profile)

    // New engine instance, same durable store — never ask twice across sessions.
    const second = createPreferenceEngine({ storage })
    const loaded = second.getProfile('user-48')
    expect(loaded.budget.typicalTripBudget).toBe(12000)
    expect(loaded.travelStyle.weatherPreference).toBe('cold')
    expect(loaded.travelStyle.favoriteDestinations).toContain('Switzerland')
  })

  it('localStorage adapter round-trips when Storage is available', () => {
    const fake: Storage = (() => {
      const map = new Map<string, string>()
      return {
        get length() { return map.size },
        clear() { map.clear() },
        getItem(key: string) { return map.get(key) ?? null },
        setItem(key: string, value: string) { map.set(key, value) },
        removeItem(key: string) { map.delete(key) },
        key(index: number) { return [...map.keys()][index] ?? null },
      }
    })()

    const storage = createLocalStoragePreferenceStorage(fake)
    expect(storage).toBeTruthy()
    const engine = createPreferenceEngine({ storage: storage! })
    const profile = emptyPersonalizationProfile('user-ls')
    profile.traveler.preferredGroupSize = 2
    engine.upsertProfile(profile)

    const again = createPreferenceEngine({ storage: storage! })
    expect(again.getProfile('user-ls').traveler.preferredGroupSize).toBe(2)
  })

  it('learns favorite destinations when a destination is locked', () => {
    const storage = createMemoryPreferenceStorage()
    const engine = createPreferenceEngine({ storage })
    learnPreferencesFromRequirements(
      mergeRequirements(emptyRequirements(), {
        destination: 'Norway',
        destinations: ['Norway'],
        budgetAmount: 18000,
        budgetCurrency: 'SAR',
        weatherPreference: 'cold',
        travelers: 2,
        travelerType: 'couple',
      }),
      { userId: 'user-fav', engine, enabled: true },
    )
    const loaded = engine.getProfile('user-fav')
    expect(loaded.travelStyle.favoriteDestinations).toContain('Norway')
    expect(loaded.budget.typicalTripBudget).toBe(18000)
    expect(loaded.travelStyle.weatherPreference).toBe('cold')
  })

  it('seeds next conversation from persisted preferences', () => {
    const storage = createMemoryPreferenceStorage()
    const engine = createPreferenceEngine({ storage })
    const profile = emptyPersonalizationProfile('user-seed')
    profile.budget.typicalTripBudget = 15000
    profile.budget.currency = 'SAR'
    profile.travelStyle.weatherPreference = 'cold'
    profile.traveler.preferredGroupSize = 2
    profile.traveler.travelerTypes = ['couple']
    engine.upsertProfile(profile)

    // Simulate next chat session with a fresh default engine pointing at same storage.
    resetPreferenceEngine()
    const nextEngine = createPreferenceEngine({ storage })
    const seeded = seedRequirementsFromPreferences(emptyRequirements(), {
      userId: 'user-seed',
      engine: nextEngine,
      enabled: true,
    })
    expect(seeded.budgetAmount).toBe(15000)
    expect(seeded.weatherPreference).toBe('cold')
    expect(seeded.travelers).toBe(2)
    expect(seeded.travelerType).toBe('couple')
  })

  it('default getPreferenceEngine respects personalization gate', () => {
    const engine = getPreferenceEngine()
    expect(engine.isPersonalizationAllowed()).toBe(true)
  })
})
