/**
 * Sprint 112 — PreferenceStore
 * In-memory persistence for traveler profiles (create / get / save / clear).
 * Future DB/Supabase can plug in behind the same interface.
 */

import { emptyMemoryTravelerProfile } from './TravelerProfile'
import type { MemoryTravelerProfile } from './types'

export interface PreferenceStore {
  get(userId: string): MemoryTravelerProfile | null
  save(profile: MemoryTravelerProfile): MemoryTravelerProfile
  create(userId: string): MemoryTravelerProfile
  clear(userId?: string): void
  listUserIds(): string[]
}

function clone(profile: MemoryTravelerProfile): MemoryTravelerProfile {
  return structuredClone(profile)
}

export function createPreferenceStore(
  seed?: Map<string, MemoryTravelerProfile>,
): PreferenceStore {
  const map = seed ?? new Map<string, MemoryTravelerProfile>()

  return {
    get(userId: string) {
      if (!userId.trim()) return null
      const existing = map.get(userId)
      return existing ? clone(existing) : null
    },
    save(profile: MemoryTravelerProfile) {
      const next = clone({
        ...profile,
        updatedAt: new Date().toISOString(),
      })
      map.set(profile.userId, next)
      return clone(next)
    },
    create(userId: string) {
      const existing = map.get(userId)
      if (existing) return clone(existing)
      const created = emptyMemoryTravelerProfile(userId)
      map.set(userId, created)
      return clone(created)
    },
    clear(userId?: string) {
      if (userId) map.delete(userId)
      else map.clear()
    },
    listUserIds() {
      return [...map.keys()]
    },
  }
}

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

export function getOrCreateMemoryProfile(
  userId: string,
  store: PreferenceStore = getPreferenceStore(),
): MemoryTravelerProfile {
  const existing = store.get(userId)
  if (existing) return existing
  return store.create(userId)
}
