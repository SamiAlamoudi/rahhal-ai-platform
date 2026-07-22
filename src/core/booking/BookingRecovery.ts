/**
 * Sprint 94 — booking recovery using Sprint 90 RetryPolicy / CircuitBreaker.
 */

import {
  classifyProviderFailure,
  createProviderCircuitBreaker,
  createProviderRetryPolicy,
  type ProviderCircuitBreaker,
  type ProviderRetryPolicyOptions,
} from '../providers'

export interface BookingRecoveryOptions {
  providerId: string
  maxAttempts?: number
  circuitBreaker?: ProviderCircuitBreaker
  sleep?: (ms: number) => Promise<void>
  retry?: ProviderRetryPolicyOptions
}

export function createBookingRecovery(options: BookingRecoveryOptions) {
  const breaker = options.circuitBreaker ?? createProviderCircuitBreaker({
    failureThreshold: 3,
    openMs: 5_000,
  })
  const retry = createProviderRetryPolicy({
    maxAttempts: options.retry?.maxAttempts ?? options.maxAttempts ?? 3,
    baseDelayMs: options.retry?.baseDelayMs ?? 15,
    maxDelayMs: options.retry?.maxDelayMs ?? 120,
    timeoutMs: options.retry?.timeoutMs ?? 5_000,
    sleep: options.retry?.sleep ?? options.sleep ?? (async () => undefined),
    circuitBreaker: options.retry?.circuitBreaker ?? breaker,
  })

  return {
    breaker,
    async execute<T>(fn: (signal: AbortSignal) => Promise<T>) {
      const outcome = await retry.execute(options.providerId, fn)
      return {
        ...outcome,
        classified: outcome.ok
          ? null
          : classifyProviderFailure(
            options.providerId,
            new Error(outcome.error ?? outcome.code ?? 'booking_failure'),
          ),
      }
    },
  }
}

export function shouldRetryBookingError(code: string | null | undefined): boolean {
  if (!code) return false
  return [
    'RATE_LIMITED',
    'SERVER_ERROR',
    'NETWORK_FAILURE',
    'TIMEOUT',
    'PROVIDER_UNAVAILABLE',
  ].includes(code)
}
