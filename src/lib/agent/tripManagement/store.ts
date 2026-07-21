/**
 * Sprint 62 — in-memory trip store (mirrors Booking Execution session store pattern).
 */

import type { ManagedTrip } from './types'

export class TripStore {
  private readonly byId = new Map<string, ManagedTrip>()

  save(trip: ManagedTrip): ManagedTrip {
    const clone = structuredClone(trip)
    this.byId.set(clone.tripId, clone)
    return structuredClone(clone)
  }

  get(tripId: string): ManagedTrip | null {
    const t = this.byId.get(tripId)
    return t ? structuredClone(t) : null
  }

  list(userId?: string): ManagedTrip[] {
    const all = [...this.byId.values()].map((t) => structuredClone(t))
    if (!userId) return all
    return all.filter((t) => t.userId === userId)
  }

  delete(tripId: string): boolean {
    return this.byId.delete(tripId)
  }

  clear(): void {
    this.byId.clear()
  }

  size(): number {
    return this.byId.size
  }
}

let defaultStore: TripStore | null = null

export function getDefaultTripStore(): TripStore {
  if (!defaultStore) defaultStore = new TripStore()
  return defaultStore
}

export function resetDefaultTripStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
