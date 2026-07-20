/**
 * Sprint 53 — resilience: retry, timeout, circuit breaker, graceful degradation.
 */

export type CircuitState = 'closed' | 'open' | 'half_open'

interface CircuitRow {
  state: CircuitState
  failures: number
  successes: number
  openedAt: number | null
  lastError: string | null
  lastLatencyMs: number | null
}

const circuits = new Map<string, CircuitRow>()

const FAILURE_THRESHOLD = 3
const OPEN_MS = 8_000

function ensure(id: string): CircuitRow {
  const existing = circuits.get(id)
  if (existing) {
    if (existing.state === 'open' && existing.openedAt != null && Date.now() - existing.openedAt >= OPEN_MS) {
      existing.state = 'half_open'
      existing.successes = 0
    }
    return existing
  }
  const created: CircuitRow = {
    state: 'closed',
    failures: 0,
    successes: 0,
    openedAt: null,
    lastError: null,
    lastLatencyMs: null,
  }
  circuits.set(id, created)
  return created
}

export function circuitAllow(providerId: string): boolean {
  const row = ensure(providerId)
  return row.state !== 'open'
}

export function circuitSuccess(providerId: string, latencyMs: number): void {
  const row = ensure(providerId)
  row.lastLatencyMs = latencyMs
  row.lastError = null
  if (row.state === 'half_open') {
    row.successes += 1
    if (row.successes >= 1) {
      row.state = 'closed'
      row.failures = 0
      row.openedAt = null
    }
    return
  }
  row.failures = 0
  row.state = 'closed'
}

export function circuitFailure(providerId: string, error: string): void {
  const row = ensure(providerId)
  row.lastError = error
  row.failures += 1
  if (row.state === 'half_open' || row.failures >= FAILURE_THRESHOLD) {
    row.state = 'open'
    row.openedAt = Date.now()
  }
}

export function circuitSnapshot(providerId: string): CircuitRow {
  return { ...ensure(providerId) }
}

export function resetCircuits(): void {
  circuits.clear()
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function withRetry<T>(
  run: () => Promise<T>,
  options?: { retries?: number; delayMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 2
  const delayMs = options?.delayMs ?? 40
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  }
  throw lastError
}

export async function callProviderResilient<T>(input: {
  providerId: string
  label: string
  timeoutMs?: number
  primary: () => Promise<T>
  fallback?: () => Promise<T>
  cacheRead?: () => T | null
}): Promise<{ value: T; degraded: boolean; latencyMs: number }> {
  const started = Date.now()
  if (!circuitAllow(input.providerId)) {
    const cached = input.cacheRead?.() ?? null
    if (cached != null) {
      return { value: cached, degraded: true, latencyMs: Date.now() - started }
    }
    if (input.fallback) {
      const value = await input.fallback()
      return { value, degraded: true, latencyMs: Date.now() - started }
    }
    throw new Error(`circuit_open:${input.providerId}`)
  }

  try {
    const value = await withRetry(
      () => withTimeout(input.primary(), input.timeoutMs ?? 2_500, input.label),
      { retries: 2, delayMs: 30 },
    )
    circuitSuccess(input.providerId, Date.now() - started)
    return { value, degraded: false, latencyMs: Date.now() - started }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    circuitFailure(input.providerId, message)
    const cached = input.cacheRead?.() ?? null
    if (cached != null) {
      return { value: cached, degraded: true, latencyMs: Date.now() - started }
    }
    if (input.fallback) {
      const value = await input.fallback()
      return { value, degraded: true, latencyMs: Date.now() - started }
    }
    throw error
  }
}
