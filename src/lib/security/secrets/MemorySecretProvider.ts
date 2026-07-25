/**
 * Sprint 14 — MemorySecretProvider (tests / staged injection).
 */

import type { SecretProvider } from './types'

export class MemorySecretProvider implements SecretProvider {
  readonly providerId = 'memory'
  readonly live = false
  private readonly store: Map<string, string>

  constructor(initial?: Record<string, string | null | undefined>) {
    this.store = new Map()
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        if (v != null && String(v).trim()) this.store.set(k, String(v))
      }
    }
  }

  set(key: string, value: string | null | undefined): void {
    if (value == null || !String(value).trim()) {
      this.store.delete(key)
      return
    }
    this.store.set(key, String(value))
  }

  get(key: string): string | null {
    return this.store.get(key) ?? null
  }

  has(key: string): boolean {
    return this.store.has(key)
  }

  listKeys(): string[] {
    return [...this.store.keys()]
  }
}

export function createMemorySecretProvider(
  initial?: Record<string, string | null | undefined>,
): MemorySecretProvider {
  return new MemorySecretProvider(initial)
}
