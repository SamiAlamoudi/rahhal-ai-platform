/**
 * Phase AB — PreferenceEngine interface + in-memory foundation.
 * Sprint 48 — optional durable PreferenceStorage (localStorage) for cross-session memory.
 */

import {
  emptyPersonalizationProfile,
  type PersonalizationProfile,
  type PreferenceWeights,
} from './types'
import {
  createLocalStoragePreferenceStorage,
  type PreferenceStorage,
} from './preferenceStorage'
import { getFeatureRegistry } from '../featureFlags'

export interface PreferenceEngineOptions {
  /** When false, engine returns empty/default profiles only. */
  personalizationAllowed?: boolean
  /** Optional durable store (localStorage / memory mock). */
  storage?: PreferenceStorage | null
}

export interface PreferenceEngine {
  getProfile(userId: string | null): PersonalizationProfile
  upsertProfile(profile: PersonalizationProfile): PersonalizationProfile
  mergeWeights(userId: string | null, weights: Partial<PreferenceWeights>): PersonalizationProfile
  isPersonalizationAllowed(): boolean
}

export class InMemoryPreferenceEngine implements PreferenceEngine {
  private readonly store = new Map<string, PersonalizationProfile>()
  private personalizationAllowed: boolean
  private readonly storage: PreferenceStorage | null

  constructor(options: PreferenceEngineOptions = {}) {
    this.personalizationAllowed = options.personalizationAllowed !== false
    this.storage = options.storage ?? null
  }

  isPersonalizationAllowed(): boolean {
    return this.personalizationAllowed
  }

  setPersonalizationAllowed(allowed: boolean): void {
    this.personalizationAllowed = allowed
  }

  getProfile(userId: string | null): PersonalizationProfile {
    if (!this.personalizationAllowed || !userId) {
      return emptyPersonalizationProfile(userId)
    }
    const cached = this.store.get(userId)
    if (cached) return structuredClone(cached)

    const persisted = this.storage?.load(userId) ?? null
    if (persisted) {
      this.store.set(userId, persisted)
      return structuredClone(persisted)
    }
    return emptyPersonalizationProfile(userId)
  }

  upsertProfile(profile: PersonalizationProfile): PersonalizationProfile {
    if (!this.personalizationAllowed) {
      return emptyPersonalizationProfile(profile.userId)
    }
    const next: PersonalizationProfile = {
      ...structuredClone(profile),
      version: 1,
      travelStyle: {
        ...emptyPersonalizationProfile(profile.userId).travelStyle,
        ...profile.travelStyle,
        interests: [...(profile.travelStyle?.interests ?? [])],
        favoriteDestinations: [...(profile.travelStyle?.favoriteDestinations ?? [])],
        rejectedDestinations: [...(profile.travelStyle?.rejectedDestinations ?? [])],
      },
      updatedAt: new Date().toISOString(),
    }
    if (profile.userId) {
      this.store.set(profile.userId, next)
      this.storage?.save(profile.userId, next)
    }
    return structuredClone(next)
  }

  mergeWeights(userId: string | null, weights: Partial<PreferenceWeights>): PersonalizationProfile {
    const current = this.getProfile(userId)
    if (!this.personalizationAllowed || !userId) return current
    const merged = {
      ...current,
      weights: { ...current.weights, ...weights },
      updatedAt: new Date().toISOString(),
    }
    return this.upsertProfile(merged)
  }

  clear(): void {
    this.store.clear()
    this.storage?.clearAll()
  }
}

let defaultEngine: InMemoryPreferenceEngine | null = null

function resolveDefaultStorage(): PreferenceStorage | null {
  try {
    if (!getFeatureRegistry().isEnabled('ai.persistent_memory')) return null
  } catch {
    return null
  }
  return createLocalStoragePreferenceStorage()
}

export function getPreferenceEngine(): InMemoryPreferenceEngine {
  if (!defaultEngine) {
    defaultEngine = new InMemoryPreferenceEngine({
      storage: resolveDefaultStorage(),
    })
  }
  return defaultEngine
}

export function resetPreferenceEngine(): void {
  defaultEngine?.clear()
  defaultEngine = null
}

export function createPreferenceEngine(
  options: PreferenceEngineOptions = {},
): InMemoryPreferenceEngine {
  return new InMemoryPreferenceEngine(options)
}
