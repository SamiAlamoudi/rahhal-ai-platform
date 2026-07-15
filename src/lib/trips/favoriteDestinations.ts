/**
 * FavoriteDestinations — mock ownership-scoped destination favorites.
 */

import type { FavoriteDestination } from './types'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `favdest_${crypto.randomUUID()}`
  }
  return `favdest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export class FavoriteDestinationsStore {
  private readonly records = new Map<string, FavoriteDestination>()

  add(userId: string, destination: string): FavoriteDestination {
    const normalized = destination.trim()
    if (!normalized) throw new Error('Destination is required')
    const existing = [...this.records.values()].find(
      (r) => r.userId === userId && r.destination.toLowerCase() === normalized.toLowerCase(),
    )
    if (existing) return structuredClone(existing)

    const record: FavoriteDestination = {
      id: generateId(),
      userId,
      destination: normalized,
      createdAt: new Date().toISOString(),
    }
    this.records.set(record.id, record)
    return structuredClone(record)
  }

  listByUser(userId: string): FavoriteDestination[] {
    return [...this.records.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => structuredClone(r))
  }

  remove(id: string, userId: string): boolean {
    const record = this.records.get(id)
    if (!record || record.userId !== userId) return false
    this.records.delete(id)
    return true
  }

  removeByDestination(userId: string, destination: string): boolean {
    const needle = destination.trim().toLowerCase()
    const match = [...this.records.values()].find(
      (r) => r.userId === userId && r.destination.toLowerCase() === needle,
    )
    if (!match) return false
    this.records.delete(match.id)
    return true
  }

  clear(): void {
    this.records.clear()
  }
}

let defaultStore: FavoriteDestinationsStore | null = null

export function getFavoriteDestinationsStore(): FavoriteDestinationsStore {
  if (!defaultStore) defaultStore = new FavoriteDestinationsStore()
  return defaultStore
}

export function resetFavoriteDestinationsStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
