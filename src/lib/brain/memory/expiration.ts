/**
 * Sprint 28 — memory expiration helpers.
 */

import type { EnrichedConversationMemory, MemoryExpirationPolicy } from './types'
import { DEFAULT_MEMORY_EXPIRATION_POLICY } from './types'
import { emptyPassportNationality } from './privacy'

export function nowMs(now?: number): number {
  return typeof now === 'number' ? now : Date.now()
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

export function expiryFromNow(
  ttlMs: number,
  now?: number,
): string {
  return toIso(nowMs(now) + ttlMs)
}

export function isExpired(expiresAt: string | null | undefined, now?: number): boolean {
  if (!expiresAt) return false
  return Date.parse(expiresAt) <= nowMs(now)
}

/**
 * Clear sensitive short-term fields after sensitive TTL relative to updatedAt.
 * Session itself may still be alive under shortTermTtlMs.
 */
export function applySensitiveExpiration(
  memory: EnrichedConversationMemory,
  policy: MemoryExpirationPolicy = DEFAULT_MEMORY_EXPIRATION_POLICY,
  now?: number,
): EnrichedConversationMemory {
  const updated = Date.parse(memory.updatedAt)
  if (!Number.isFinite(updated)) return memory
  if (nowMs(now) - updated < policy.sensitiveTtlMs) return memory
  if (!memory.passportNationality.explicitlyProvided) return memory
  return {
    ...memory,
    passportNationality: emptyPassportNationality(),
    loyaltyPrograms: memory.loyaltyPrograms.map((l) => ({
      program: l.program,
      memberNumber: null,
    })),
  }
}

export function resolvePolicy(
  partial?: Partial<MemoryExpirationPolicy>,
): MemoryExpirationPolicy {
  return {
    ...DEFAULT_MEMORY_EXPIRATION_POLICY,
    ...partial,
  }
}
