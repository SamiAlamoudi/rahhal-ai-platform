/**
 * Sprint 27 — orchestrator turn cache (TTL). Provider-independent.
 */

import type { AITripOrchestratorTurnResult } from './types'

interface CacheEntry {
  value: AITripOrchestratorTurnResult
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

export function buildOrchestratorCacheKey(parts: {
  conversationId: string
  userText: string
  locale?: string
}): string {
  const text = parts.userText.trim().toLowerCase().replace(/\s+/g, ' ')
  return `orch:${parts.conversationId}:${parts.locale ?? 'ar'}:${text}`
}

export function getOrchestratorCached(
  key: string,
): AITripOrchestratorTurnResult | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value
}

export function setOrchestratorCached(
  key: string,
  value: AITripOrchestratorTurnResult,
  ttlMs: number,
): void {
  if (ttlMs <= 0) return
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function clearOrchestratorCache(): void {
  store.clear()
}

export function orchestratorCacheSize(): number {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key)
  }
  return store.size
}
