/**
 * Lightweight in-memory TTL cache for TravelDataService.
 */

export class TravelDataCache {
  private store = new Map<string, { expiresAt: number; value: unknown }>()
  private readonly defaultTtlMs: number

  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs
  }

  get<T>(key: string): T | null {
    const row = this.store.get(key)
    if (!row) return null
    if (Date.now() > row.expiresAt) {
      this.store.delete(key)
      return null
    }
    return row.value as T
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}
