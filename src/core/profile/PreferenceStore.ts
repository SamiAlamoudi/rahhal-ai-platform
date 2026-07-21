/**
 * Sprint 80 — local PreferenceStore (mock / in-memory). Privacy: local only.
 */

import {
  type TravelerProfile,
  type PreferenceEntry,
  type BehaviorEvent,
} from './TravelerProfile'

export interface PreferenceStore {
  get(userId: string): TravelerProfile | null
  save(profile: TravelerProfile): TravelerProfile
  reset(userId: string): void
  clearAll(): void
  setLearningEnabled(userId: string, enabled: boolean): TravelerProfile | null
}

function now(): string {
  return new Date().toISOString()
}

export function emptyTravelerProfile(userId: string): TravelerProfile {
  const ts = now()
  return {
    userId,
    version: 1,
    learningEnabled: true,
    preferences: [],
    behaviorHistory: [],
    weightBiases: {},
    createdAt: ts,
    updatedAt: ts,
  }
}

function clone(profile: TravelerProfile): TravelerProfile {
  return structuredClone(profile)
}

export function createPreferenceStore(
  seed?: Map<string, TravelerProfile>,
): PreferenceStore {
  const map = seed ?? new Map<string, TravelerProfile>()

  return {
    get(userId) {
      if (!userId) return null
      const existing = map.get(userId)
      return existing ? clone(existing) : null
    },
    save(profile) {
      const next = clone({ ...profile, updatedAt: now() })
      map.set(profile.userId, next)
      return clone(next)
    },
    reset(userId) {
      map.delete(userId)
    },
    clearAll() {
      map.clear()
    },
    setLearningEnabled(userId, enabled) {
      const existing = map.get(userId) ?? emptyTravelerProfile(userId)
      const next = { ...existing, learningEnabled: enabled, updatedAt: now() }
      map.set(userId, next)
      return clone(next)
    },
  }
}

/** Process-local default store. */
let defaultStore: PreferenceStore | null = null

export function getPreferenceStore(): PreferenceStore {
  if (!defaultStore) defaultStore = createPreferenceStore()
  return defaultStore
}

export function setPreferenceStore(store: PreferenceStore | null): void {
  defaultStore = store
}

export function resetPreferenceStore(): void {
  defaultStore = createPreferenceStore()
}

export function getOrCreateProfile(
  userId: string,
  store: PreferenceStore = getPreferenceStore(),
): TravelerProfile {
  const existing = store.get(userId)
  if (existing) return existing
  return store.save(emptyTravelerProfile(userId))
}

export type { PreferenceEntry, BehaviorEvent, TravelerProfile }
