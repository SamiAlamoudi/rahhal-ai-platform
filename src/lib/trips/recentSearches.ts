/**
 * RecentSearches — mock recent search history for Phase V trip management.
 */

import { sanitizeAuditMetadata } from './privacy'
import type { RecentSearchRecord } from './types'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `rsearch_${crypto.randomUUID()}`
  }
  return `rsearch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export class RecentSearchesStore {
  private readonly records: RecentSearchRecord[] = []
  private readonly maxPerUser: number

  constructor(maxPerUser = 50) {
    this.maxPerUser = maxPerUser
  }

  add(input: {
    userId: string
    query: string
    destination?: string | null
    metadata?: Record<string, unknown>
  }): RecentSearchRecord {
    const record: RecentSearchRecord = {
      id: generateId(),
      userId: input.userId,
      query: input.query.trim(),
      destination: input.destination?.trim() || null,
      searchedAt: new Date().toISOString(),
      metadata: sanitizeAuditMetadata(input.metadata),
    }
    this.records.unshift(record)
    const yours = this.records.filter((r) => r.userId === input.userId)
    if (yours.length > this.maxPerUser) {
      const drop = yours.slice(this.maxPerUser)
      for (const d of drop) {
        const idx = this.records.findIndex((r) => r.id === d.id)
        if (idx >= 0) this.records.splice(idx, 1)
      }
    }
    return structuredClone(record)
  }

  listByUser(userId: string, limit = 20): RecentSearchRecord[] {
    return this.records
      .filter((r) => r.userId === userId)
      .slice(0, limit)
      .map((r) => structuredClone(r))
  }

  clearUser(userId: string): void {
    for (let i = this.records.length - 1; i >= 0; i -= 1) {
      if (this.records[i].userId === userId) this.records.splice(i, 1)
    }
  }

  clear(): void {
    this.records.length = 0
  }
}

let defaultStore: RecentSearchesStore | null = null

export function getRecentSearchesStore(): RecentSearchesStore {
  if (!defaultStore) defaultStore = new RecentSearchesStore()
  return defaultStore
}

export function resetRecentSearchesStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
