/**
 * Retry and timeout budgets for reliability.
 */

export interface RetryBudget {
  maxAttempts: number
  maxTotalMs: number
  consumedAttempts: number
  startedAt: number
}

export interface TimeoutBudget {
  totalMs: number
  startedAt: number
}

export function createRetryBudget(maxAttempts = 3, maxTotalMs = 8_000): RetryBudget {
  return {
    maxAttempts,
    maxTotalMs,
    consumedAttempts: 0,
    startedAt: Date.now(),
  }
}

export function canRetry(budget: RetryBudget): boolean {
  if (budget.consumedAttempts >= budget.maxAttempts) return false
  return Date.now() - budget.startedAt < budget.maxTotalMs
}

export function consumeRetry(budget: RetryBudget): void {
  budget.consumedAttempts += 1
}

export function createTimeoutBudget(totalMs = 5_000): TimeoutBudget {
  return { totalMs, startedAt: Date.now() }
}

export function remainingTimeoutMs(budget: TimeoutBudget): number {
  return Math.max(0, budget.totalMs - (Date.now() - budget.startedAt))
}

export function isTimeoutBudgetExhausted(budget: TimeoutBudget): boolean {
  return remainingTimeoutMs(budget) <= 0
}

/** Combine AbortSignals; cancels stale work when parent aborts or timeout fires. */
export function createStaleRequestController(timeoutMs: number, parent?: AbortSignal): {
  signal: AbortSignal
  cancel: (reason?: string) => void
  dispose: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), Math.max(1, timeoutMs))

  const onParentAbort = () => controller.abort(parent?.reason ?? 'aborted')
  if (parent) {
    if (parent.aborted) onParentAbort()
    else parent.addEventListener('abort', onParentAbort, { once: true })
  }

  return {
    signal: controller.signal,
    cancel: (reason = 'cancelled') => controller.abort(reason),
    dispose: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParentAbort)
    },
  }
}
