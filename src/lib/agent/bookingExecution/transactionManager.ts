/**
 * Transaction Manager — Sprint 57.
 * Retries, rollback, idempotency, timeout handling, partial failure recovery.
 */

import { isTransactionManagerEnabled } from './feature'
import type { TransactionManagerOptions } from './types'

export type TransactionAttemptResult<T> =
  | { ok: true; value: T; attempts: number; latencyMs: number }
  | { ok: false; error: string; attempts: number; latencyMs: number; timedOut?: boolean }

export class TransactionManager {
  private readonly maxRetries: number
  private readonly timeoutMs: number
  private readonly retryDelayMs: number
  private readonly enabled: boolean
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly idempotencyCache = new Map<string, unknown>()
  private readonly rollbackStack: Array<() => Promise<void>> = []

  constructor(options: TransactionManagerOptions = {}) {
    this.enabled = isTransactionManagerEnabled({ enabled: options.enabled })
    this.maxRetries = options.maxRetries ?? (this.enabled ? 2 : 0)
    this.timeoutMs = options.timeoutMs ?? 8_000
    this.retryDelayMs = options.retryDelayMs ?? 25
    this.now = options.now ?? (() => Date.now())
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  getIdempotent<T>(key: string): T | undefined {
    return this.idempotencyCache.get(key) as T | undefined
  }

  setIdempotent<T>(key: string, value: T): void {
    this.idempotencyCache.set(key, value)
  }

  pushRollback(fn: () => Promise<void>): void {
    this.rollbackStack.push(fn)
  }

  async rollbackAll(): Promise<{ rolledBack: number; errors: string[] }> {
    const errors: string[] = []
    let rolledBack = 0
    while (this.rollbackStack.length > 0) {
      const fn = this.rollbackStack.pop()
      if (!fn) break
      try {
        await fn()
        rolledBack += 1
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'rollback_failed')
      }
    }
    return { rolledBack, errors }
  }

  clearRollbacks(): void {
    this.rollbackStack.length = 0
  }

  async runWithRetry<T>(
    label: string,
    fn: (attempt: number, signal: AbortSignal) => Promise<T>,
    options?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<TransactionAttemptResult<T>> {
    if (options?.idempotencyKey) {
      const cached = this.getIdempotent<T>(options.idempotencyKey)
      if (cached !== undefined) {
        return { ok: true, value: cached, attempts: 0, latencyMs: 0 }
      }
    }

    const started = this.now()
    let attempts = 0
    let lastError = 'unknown_error'
    const maxAttempts = this.maxRetries + 1

    while (attempts < maxAttempts) {
      attempts += 1
      const controller = new AbortController()
      const onAbort = () => controller.abort()
      options?.signal?.addEventListener('abort', onAbort)

      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error(`timeout:${label}`))
          }, this.timeoutMs)
        })
        const value = await Promise.race([
          fn(attempts, controller.signal),
          timeoutPromise,
        ])
        if (timer) clearTimeout(timer)
        options?.signal?.removeEventListener('abort', onAbort)
        if (options?.idempotencyKey) this.setIdempotent(options.idempotencyKey, value)
        return {
          ok: true,
          value,
          attempts,
          latencyMs: this.now() - started,
        }
      } catch (err) {
        if (timer) clearTimeout(timer)
        options?.signal?.removeEventListener('abort', onAbort)
        lastError = err instanceof Error ? err.message : String(err)
        const timedOut = lastError.startsWith('timeout:')
        const retryable = !options?.signal?.aborted && attempts < maxAttempts
        if (!retryable) {
          return {
            ok: false,
            error: lastError,
            attempts,
            latencyMs: this.now() - started,
            timedOut,
          }
        }
        if (this.enabled) await this.sleep(this.retryDelayMs * attempts)
      }
    }

    return {
      ok: false,
      error: lastError,
      attempts,
      latencyMs: this.now() - started,
    }
  }
}
