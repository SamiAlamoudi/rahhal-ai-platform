/**
 * Phase AA — in-memory feedback repository.
 */

import type { FeedbackRecord } from './types'

export class FeedbackRepository {
  private readonly records = new Map<string, FeedbackRecord>()
  private readonly dedupeIndex = new Map<string, string>()

  create(record: FeedbackRecord): FeedbackRecord {
    if (record.dedupeKey) {
      const existingId = this.dedupeIndex.get(record.dedupeKey)
      if (existingId) {
        const existing = this.records.get(existingId)
        if (existing) return structuredClone(existing)
      }
      this.dedupeIndex.set(record.dedupeKey, record.id)
    }
    this.records.set(record.id, structuredClone(record))
    return structuredClone(record)
  }

  get(id: string): FeedbackRecord | null {
    const row = this.records.get(id)
    return row ? structuredClone(row) : null
  }

  listByVersion(appVersion: string): FeedbackRecord[] {
    return [...this.records.values()]
      .filter((r) => r.appVersion === appVersion)
      .map((r) => structuredClone(r))
  }

  listAll(): FeedbackRecord[] {
    return [...this.records.values()].map((r) => structuredClone(r))
  }

  update(id: string, patch: Partial<FeedbackRecord>): FeedbackRecord | null {
    const current = this.records.get(id)
    if (!current) return null
    const next = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    }
    this.records.set(id, structuredClone(next))
    return this.get(id)
  }

  clear(): void {
    this.records.clear()
    this.dedupeIndex.clear()
  }
}

let defaultRepo: FeedbackRepository | null = null

export function getFeedbackRepository(): FeedbackRepository {
  if (!defaultRepo) defaultRepo = new FeedbackRepository()
  return defaultRepo
}

export function resetFeedbackRepository(): void {
  defaultRepo?.clear()
  defaultRepo = null
}
