import type { RetryPolicy } from './types'

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 40,
  maxDelayMs: 250,
}

export async function withRetry<T>(input: {
  policy: RetryPolicy
  signal?: AbortSignal
  shouldRetry: (error: unknown, attempt: number) => boolean
  run: (attempt: number) => Promise<T>
}): Promise<{ value: T; attempts: number }> {
  const maxAttempts = Math.max(1, input.policy.maxAttempts)
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (input.signal?.aborted) throw new Error('aborted')
    try {
      const value = await input.run(attempt)
      return { value, attempts: attempt }
    } catch (error) {
      lastError = error
      const canRetry = attempt < maxAttempts && input.shouldRetry(error, attempt)
      if (!canRetry) break
      const delay = Math.min(
        input.policy.maxDelayMs,
        input.policy.baseDelayMs * 2 ** (attempt - 1),
      )
      await sleep(delay, input.signal)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'retry_failed'))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
