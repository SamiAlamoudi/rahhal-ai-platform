/**
 * Sprint 71 — Retry policy (exponential backoff + timeout + circuit breaker).
 */

import {
  createCircuitBreaker,
  type CircuitBreaker,
} from '../aggregation/liveIntegration/circuitBreaker'

export interface RetryPolicyOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  timeoutMs?: number
  circuitBreaker?: CircuitBreaker
}

export interface RetryOutcome<T> {
  ok: boolean
  value?: T
  attempts: number
  error?: string
  timedOut: boolean
  circuitOpen: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createProviderRetryPolicy(options: RetryPolicyOptions = {}) {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 50
  const maxDelayMs = options.maxDelayMs ?? 2_000
  const timeoutMs = options.timeoutMs ?? 5_000
  const breaker = options.circuitBreaker ?? createCircuitBreaker({
    failureThreshold: 3,
    openMs: 5_000,
  })

  return {
    breaker,
    async execute<T>(
      providerId: string,
      fn: (signal: AbortSignal) => Promise<T>,
    ): Promise<RetryOutcome<T>> {
      if (!breaker.allow(providerId)) {
        return {
          ok: false,
          attempts: 0,
          error: 'circuit_open',
          timedOut: false,
          circuitOpen: true,
        }
      }

      let attempts = 0
      let lastError = 'unknown'
      for (let i = 0; i < maxAttempts; i++) {
        attempts = i + 1
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const value = await fn(controller.signal)
          clearTimeout(timer)
          breaker.recordSuccess(providerId)
          return {
            ok: true,
            value,
            attempts,
            timedOut: false,
            circuitOpen: false,
          }
        } catch (err) {
          clearTimeout(timer)
          const timedOut = controller.signal.aborted
          lastError = timedOut
            ? 'timeout'
            : err instanceof Error
              ? err.message
              : String(err)
          breaker.recordFailure(providerId)
          if (i < maxAttempts - 1) {
            const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** i)
            await sleep(delay)
          }
          if (!breaker.allow(providerId) && i < maxAttempts - 1) {
            return {
              ok: false,
              attempts,
              error: lastError,
              timedOut,
              circuitOpen: true,
            }
          }
        }
      }
      return {
        ok: false,
        attempts,
        error: lastError,
        timedOut: lastError === 'timeout',
        circuitOpen: !breaker.allow(providerId),
      }
    },
  }
}

export type ProviderRetryPolicy = ReturnType<typeof createProviderRetryPolicy>
