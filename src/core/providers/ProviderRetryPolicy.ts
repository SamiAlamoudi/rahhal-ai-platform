/**
 * Sprint 90 — retry policy for network / 429 / 5xx / DNS / timeout.
 */

import { classifyProviderFailure, isRetryableCode, ProviderError } from './ProviderErrors'
import {
  createProviderCircuitBreaker,
  type ProviderCircuitBreaker,
} from './ProviderCircuitBreaker'

export interface ProviderRetryPolicyOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  timeoutMs?: number
  circuitBreaker?: ProviderCircuitBreaker
  sleep?: (ms: number) => Promise<void>
}

export interface ProviderRetryOutcome<T> {
  ok: boolean
  value?: T
  attempts: number
  error?: string
  code?: string
  timedOut: boolean
  circuitOpen: boolean
  retried: boolean
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createProviderRetryPolicy(options: ProviderRetryPolicyOptions = {}) {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 40
  const maxDelayMs = options.maxDelayMs ?? 1_500
  const timeoutMs = options.timeoutMs ?? 5_000
  const sleep = options.sleep ?? defaultSleep
  const breaker = options.circuitBreaker ?? createProviderCircuitBreaker({
    failureThreshold: 3,
    openMs: 5_000,
  })

  return {
    breaker,
    async execute<T>(
      providerId: string,
      fn: (signal: AbortSignal) => Promise<T>,
    ): Promise<ProviderRetryOutcome<T>> {
      if (!breaker.allow(providerId)) {
        return {
          ok: false,
          attempts: 0,
          error: 'circuit_open',
          code: 'CIRCUIT_OPEN',
          timedOut: false,
          circuitOpen: true,
          retried: false,
        }
      }

      let attempts = 0
      let lastError = 'unknown'
      let lastCode = 'UNKNOWN'
      let timedOut = false

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
            retried: attempts > 1,
          }
        } catch (err) {
          clearTimeout(timer)
          timedOut = controller.signal.aborted
          const classified = classifyProviderFailure(
            providerId,
            timedOut ? new Error('timeout') : err,
          )
          lastError = classified.message
          lastCode = classified.code
          breaker.recordFailure(providerId)

          const shouldRetry = classified.retryable || isRetryableCode(classified.code)
          if (!shouldRetry || attempts >= maxAttempts) {
            return {
              ok: false,
              attempts,
              error: lastError,
              code: lastCode,
              timedOut,
              circuitOpen: !breaker.allow(providerId),
              retried: attempts > 1,
            }
          }

          if (!breaker.allow(providerId)) {
            return {
              ok: false,
              attempts,
              error: 'circuit_open',
              code: 'CIRCUIT_OPEN',
              timedOut,
              circuitOpen: true,
              retried: attempts > 1,
            }
          }

          const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempts - 1))
          await sleep(delay)
        }
      }

      return {
        ok: false,
        attempts,
        error: lastError,
        code: lastCode,
        timedOut,
        circuitOpen: false,
        retried: attempts > 1,
      }
    },
  }
}

export function shouldRetryProviderError(err: ProviderError): boolean {
  return err.retryable
}
