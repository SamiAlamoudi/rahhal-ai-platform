/**
 * Sprint 76 — mock storage abstraction for traveler profiles.
 * Future persistence (DB / Supabase) plugs in behind TravelerProfileStore.
 */

import type { TravelerProfile } from './types'
import { emptyTravelerProfile } from './profile'

export interface TravelerProfileStore {
  get(userId: string): TravelerProfile | null
  save(profile: TravelerProfile): TravelerProfile
  clear(userId?: string): void
}

function clone(profile: TravelerProfile): TravelerProfile {
  return structuredClone(profile)
}

export function createMockTravelerProfileStore(
  seed?: Map<string, TravelerProfile>,
): TravelerProfileStore {
  const store = seed ?? new Map<string, TravelerProfile>()

  return {
    get(userId: string) {
      if (!userId) return null
      const existing = store.get(userId)
      return existing ? clone(existing) : null
    },
    save(profile: TravelerProfile) {
      const next = clone({
        ...profile,
        updatedAt: new Date().toISOString(),
      })
      store.set(profile.userId, next)
      return clone(next)
    },
    clear(userId?: string) {
      if (userId) store.delete(userId)
      else store.clear()
    },
  }
}

/** Process-local mock store (no database). */
let defaultStore: TravelerProfileStore | null = null

export function getTravelerProfileStore(): TravelerProfileStore {
  if (!defaultStore) defaultStore = createMockTravelerProfileStore()
  return defaultStore
}

export function setTravelerProfileStore(store: TravelerProfileStore | null): void {
  defaultStore = store
}

export function resetTravelerProfileStore(): void {
  defaultStore = createMockTravelerProfileStore()
}

export function getOrCreateProfile(
  userId: string,
  store: TravelerProfileStore = getTravelerProfileStore(),
): TravelerProfile {
  const existing = store.get(userId)
  if (existing) return existing
  const created = emptyTravelerProfile(userId)
  return store.save(created)
}
