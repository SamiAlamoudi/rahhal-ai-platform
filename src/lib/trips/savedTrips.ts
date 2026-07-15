/**
 * SavedTrips — Phase V mock store for saved trip snapshots.
 * Separate from Supabase savedTripRepository; does not change TripPlan APIs.
 */

import type { SavedTripRecord } from './types'

export interface SaveTripInput {
  userId: string
  title: string
  destination: string
  tripId?: string | null
  payload?: Record<string, unknown>
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `saved_${crypto.randomUUID()}`
  }
  return `saved_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export class SavedTripsStore {
  private readonly records = new Map<string, SavedTripRecord>()

  save(input: SaveTripInput): SavedTripRecord {
    const now = new Date().toISOString()
    const record: SavedTripRecord = {
      id: generateId(),
      userId: input.userId,
      title: input.title.trim() || 'Saved trip',
      destination: input.destination.trim(),
      tripId: input.tripId ?? null,
      payload: structuredClone(input.payload ?? {}),
      createdAt: now,
      updatedAt: now,
    }
    this.records.set(record.id, record)
    return structuredClone(record)
  }

  listByUser(userId: string): SavedTripRecord[] {
    return [...this.records.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((r) => structuredClone(r))
  }

  getByIdForUser(id: string, userId: string): SavedTripRecord | null {
    const record = this.records.get(id)
    if (!record || record.userId !== userId) return null
    return structuredClone(record)
  }

  delete(id: string, userId: string): boolean {
    const record = this.records.get(id)
    if (!record || record.userId !== userId) return false
    this.records.delete(id)
    return true
  }

  clear(): void {
    this.records.clear()
  }
}

let defaultStore: SavedTripsStore | null = null

export function getSavedTripsStore(): SavedTripsStore {
  if (!defaultStore) defaultStore = new SavedTripsStore()
  return defaultStore
}

export function resetSavedTripsStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
