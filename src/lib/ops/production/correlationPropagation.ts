/**
 * Phase AI — correlation ID propagation helpers for every service call.
 */

import {
  createCorrelationId,
  getCorrelationId,
  setCorrelationId,
  withCorrelationId,
} from '../logging/correlation'
import { getLogger } from '../logging/structuredLogger'
import { withSpan } from './tracing'

const HEADER = 'x-correlation-id'

export function correlationHeaderName(): string {
  return HEADER
}

/** Read correlation id from Fetch/Request-like headers (case-insensitive). */
export function correlationIdFromHeaders(
  headers: Headers | Record<string, string | null | undefined> | null | undefined,
): string {
  if (!headers) return createCorrelationId()
  if (headers instanceof Headers) {
    const value = headers.get(HEADER)?.trim()
    return value && value.length >= 8 ? value : createCorrelationId()
  }
  const raw =
    headers[HEADER] ??
    headers['X-Correlation-Id'] ??
    headers['X-CORRELATION-ID']
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value.length >= 8 ? value : createCorrelationId()
}

export function applyCorrelationToHeaders(
  headers: Headers | Record<string, string>,
  correlationId: string = getCorrelationId(),
): void {
  if (headers instanceof Headers) {
    headers.set(HEADER, correlationId)
    return
  }
  headers[HEADER] = correlationId
}

/**
 * Run a service operation with an established correlation id + tracing span.
 */
export function runWithCorrelation<T>(input: {
  correlationId?: string
  domain: string
  operation: string
  fn: () => Promise<T> | T
}): Promise<T> {
  const correlationId = input.correlationId?.trim() || getCorrelationId() || createCorrelationId()
  return withCorrelationId(correlationId, () => {
    setCorrelationId(correlationId)
    const logger = getLogger()
    const started = Date.now()
    return withSpan(
      `${input.domain}.${input.operation}`,
      async (span) => {
        span.setAttribute('service.domain', input.domain)
        span.setAttribute('service.operation', input.operation)
        try {
          const result = await input.fn()
          logger.info(input.domain, input.operation, `${input.operation}_ok`, {
            correlationId,
            durationMs: Date.now() - started,
            success: true,
          })
          return result
        } catch (error) {
          logger.error(
            input.domain,
            input.operation,
            error instanceof Error ? error.message : String(error),
            {
              correlationId,
              durationMs: Date.now() - started,
              success: false,
            },
          )
          throw error
        }
      },
      { 'correlation.id': correlationId },
    )
  }) as Promise<T>
}
