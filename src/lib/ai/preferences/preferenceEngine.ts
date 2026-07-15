/**
 * Phase AB — PreferenceEngine interface + in-memory foundation.
 * Respects privacy_personalization gate when provided.
 */

import {
  emptyPersonalizationProfile,
  type PersonalizationProfile,
  type PreferenceWeights,
} from './types'

export interface PreferenceEngineOptions {
  /** When false, engine returns empty/default profiles only. */
  personalizationAllowed?: boolean
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

  constructor(options: PreferenceEngineOptions = {}) {
    this.personalizationAllowed = options.personalizationAllowed !== false
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
    return this.store.get(userId) ?? emptyPersonalizationProfile(userId)
  }

  upsertProfile(profile: PersonalizationProfile): PersonalizationProfile {
    if (!this.personalizationAllowed) {
      return emptyPersonalizationProfile(profile.userId)
    }
    const next = {
      ...structuredClone(profile),
      version: 1 as const,
      updatedAt: new Date().toISOString(),
    }
    if (profile.userId) this.store.set(profile.userId, next)
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
  }
}

let defaultEngine: InMemoryPreferenceEngine | null = null

export function getPreferenceEngine(): InMemoryPreferenceEngine {
  if (!defaultEngine) defaultEngine = new InMemoryPreferenceEngine()
  return defaultEngine
}

export function resetPreferenceEngine(): void {
  defaultEngine?.clear()
  defaultEngine = null
}
