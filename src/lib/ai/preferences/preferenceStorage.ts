/**
 * Sprint 48 — Preference persistence adapters (localStorage).
 * No server/PII tables — taste profiles only (Phase AB contract).
 */

import type { PersonalizationProfile } from './types'
import { emptyPersonalizationProfile } from './types'

export const PREFERENCE_STORAGE_PREFIX = 'rahhal.pref.v1:'

export interface PreferenceStorage {
  load(userId: string): PersonalizationProfile | null
  save(userId: string, profile: PersonalizationProfile): void
  remove(userId: string): void
  clearAll(): void
}

export function createMemoryPreferenceStorage(): PreferenceStorage {
  const map = new Map<string, PersonalizationProfile>()
  return {
    load(userId) {
      return map.get(userId) ?? null
    },
    save(userId, profile) {
      map.set(userId, structuredClone(profile))
    },
    remove(userId) {
      map.delete(userId)
    },
    clearAll() {
      map.clear()
    },
  }
}

export function createLocalStoragePreferenceStorage(
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
): PreferenceStorage | null {
  if (!storage) return null

  const keyFor = (userId: string) => `${PREFERENCE_STORAGE_PREFIX}${userId}`

  return {
    load(userId) {
      try {
        const raw = storage.getItem(keyFor(userId))
        if (!raw) return null
        const parsed = JSON.parse(raw) as PersonalizationProfile
        if (!parsed || parsed.version !== 1) return null
        return normalizeStoredProfile(parsed, userId)
      } catch {
        return null
      }
    },
    save(userId, profile) {
      try {
        storage.setItem(keyFor(userId), JSON.stringify(normalizeStoredProfile(profile, userId)))
      } catch {
        // Quota / private mode — degrade silently to memory-only.
      }
    },
    remove(userId) {
      try {
        storage.removeItem(keyFor(userId))
      } catch {
        // ignore
      }
    },
    clearAll() {
      try {
        const keys: string[] = []
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i)
          if (key?.startsWith(PREFERENCE_STORAGE_PREFIX)) keys.push(key)
        }
        for (const key of keys) storage.removeItem(key)
      } catch {
        // ignore
      }
    },
  }
}

function normalizeStoredProfile(
  raw: PersonalizationProfile,
  userId: string,
): PersonalizationProfile {
  const base = emptyPersonalizationProfile(userId)
  return {
    ...base,
    ...raw,
    userId,
    version: 1,
    traveler: { ...base.traveler, ...raw.traveler },
    hotel: { ...base.hotel, ...raw.hotel },
    airline: { ...base.airline, ...raw.airline },
    budget: { ...base.budget, ...raw.budget },
    travelStyle: {
      ...base.travelStyle,
      ...raw.travelStyle,
      interests: Array.isArray(raw.travelStyle?.interests) ? raw.travelStyle.interests : [],
      favoriteDestinations: Array.isArray(raw.travelStyle?.favoriteDestinations)
        ? raw.travelStyle.favoriteDestinations
        : [],
      rejectedDestinations: Array.isArray(raw.travelStyle?.rejectedDestinations)
        ? raw.travelStyle.rejectedDestinations
        : [],
    },
    weights: { ...base.weights, ...raw.weights },
    updatedAt: raw.updatedAt || new Date().toISOString(),
  }
}
