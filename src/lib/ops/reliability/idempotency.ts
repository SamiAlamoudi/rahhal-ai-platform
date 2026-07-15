/**
 * Idempotency enforcement for mutating operations.
 */

import { getOpsMetrics } from '../observability/metricsRegistry'

export interface IdempotencyRecord<T> {
  key: string
  createdAt: string
  result: T
}

export class IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord<unknown>>()
  private readonly ttlMs: number

  constructor(ttlMs = 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs
  }

  get<T>(key: string): IdempotencyRecord<T> | null {
    const row = this.records.get(key)
    if (!row) return null
    if (Date.parse(row.createdAt) + this.ttlMs < Date.now()) {
      this.records.delete(key)
      return null
    }
    return row as IdempotencyRecord<T>
  }

  set<T>(key: string, result: T): IdempotencyRecord<T> {
    const row: IdempotencyRecord<T> = {
      key,
      createdAt: new Date().toISOString(),
      result,
    }
    this.records.set(key, row as IdempotencyRecord<unknown>)
    return row
  }

  async runOnce<T>(key: string, fn: () => Promise<T> | T): Promise<{ result: T; replayed: boolean }> {
    const existing = this.get<T>(key)
    if (existing) {
      getOpsMetrics().incr('ops.idempotency_hits', { domain: 'ops' })
      return { result: existing.result, replayed: true }
    }
    const result = await fn()
    this.set(key, result)
    return { result, replayed: false }
  }

  clear(): void {
    this.records.clear()
  }
}

let defaultStore: IdempotencyStore | null = null

export function getIdempotencyStore(): IdempotencyStore {
  if (!defaultStore) defaultStore = new IdempotencyStore()
  return defaultStore
}

export function resetIdempotencyStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
