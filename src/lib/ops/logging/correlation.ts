/**
 * Request / correlation ID helpers for structured logs.
 */

const CORRELATION_KEY = 'rahhal.correlationId'

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

let currentCorrelationId: string | null = null

export function createCorrelationId(): string {
  return randomId()
}

export function getCorrelationId(): string {
  if (currentCorrelationId) return currentCorrelationId
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem(CORRELATION_KEY)
      if (existing) {
        currentCorrelationId = existing
        return existing
      }
    }
  } catch {
    /* ignore */
  }
  const id = createCorrelationId()
  setCorrelationId(id)
  return id
}

export function setCorrelationId(id: string): void {
  currentCorrelationId = id
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CORRELATION_KEY, id)
    }
  } catch {
    /* ignore */
  }
}

export function withCorrelationId<T>(id: string, fn: () => T): T {
  const previous = currentCorrelationId
  setCorrelationId(id)
  try {
    return fn()
  } finally {
    currentCorrelationId = previous
  }
}
