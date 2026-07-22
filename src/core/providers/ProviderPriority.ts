/**
 * Sprint 90 — provider priority tiers + automatic failover.
 */

import type { ProviderPriorityTier, TravelProvider } from './types'
import { ProviderError } from './ProviderErrors'

export interface PrioritizedProvider {
  provider: TravelProvider
  tier: ProviderPriorityTier
  /** Lower number = higher preference within the same tier. */
  rank: number
}

export interface FailoverAttempt {
  providerId: string
  tier: ProviderPriorityTier
  ok: boolean
  error?: string
  latencyMs: number
}

export interface FailoverResult<T> {
  ok: boolean
  value?: T
  providerId?: string
  tier?: ProviderPriorityTier
  attempts: FailoverAttempt[]
  failoverUsed: boolean
}

export function sortProvidersByPriority(
  entries: PrioritizedProvider[],
): PrioritizedProvider[] {
  const tierOrder: Record<ProviderPriorityTier, number> = {
    primary: 0,
    secondary: 1,
    fallback: 2,
  }
  return [...entries].sort((a, b) => {
    const t = tierOrder[a.tier] - tierOrder[b.tier]
    if (t !== 0) return t
    return a.rank - b.rank
  })
}

/**
 * Try providers in priority order until one succeeds.
 */
export async function executeWithFailover<T>(
  entries: PrioritizedProvider[],
  run: (provider: TravelProvider) => Promise<T>,
): Promise<FailoverResult<T>> {
  const ordered = sortProvidersByPriority(entries)
  const attempts: FailoverAttempt[] = []

  for (const entry of ordered) {
    const started = performance.now()
    try {
      const value = await run(entry.provider)
      attempts.push({
        providerId: entry.provider.id,
        tier: entry.tier,
        ok: true,
        latencyMs: Math.round(performance.now() - started),
      })
      return {
        ok: true,
        value,
        providerId: entry.provider.id,
        tier: entry.tier,
        attempts,
        failoverUsed: attempts.length > 1,
      }
    } catch (err) {
      const message = err instanceof ProviderError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err)
      attempts.push({
        providerId: entry.provider.id,
        tier: entry.tier,
        ok: false,
        error: message,
        latencyMs: Math.round(performance.now() - started),
      })
    }
  }

  return {
    ok: false,
    attempts,
    failoverUsed: attempts.length > 1,
  }
}

export type { ProviderPriorityTier }
