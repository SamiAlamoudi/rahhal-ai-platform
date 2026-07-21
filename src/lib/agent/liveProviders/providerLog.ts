/**
 * Structured provider request logging — Sprint 59 / 60.
 * Logs request id, duration, status, and provider name only.
 * Never logs secrets, tokens, or credential material.
 */

export type ProviderLogStatus =
  | 'ok'
  | 'empty'
  | 'error'
  | 'rate_limit'
  | 'invalid_airport'
  | 'invalid_destination'
  | 'unavailable'
  | 'timeout'
  | 'expired_token'
  | 'auth_retry'

export type ProviderLogEntry = {
  requestId: string
  provider: string
  operation: string
  durationMs: number
  status: ProviderLogStatus | string
  httpStatus?: number | null
  detail?: string | null
}

export type ProviderLogSink = (entry: ProviderLogEntry) => void

const SECRET_PATTERNS: RegExp[] = [
  /bearer\s+\S+/gi,
  /(?:api[_-]?key|api[_-]?secret|client[_-]?secret|client[_-]?id|access[_-]?token|x-rapidapi-key)\s*[:=]\s*\S+/gi,
  /authorization\s*[:=]\s*\S+/gi,
]

function sanitizeDetail(detail: string | null | undefined): string | null {
  if (!detail) return null
  let out = detail
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]')
  }
  return out.slice(0, 200)
}

let sink: ProviderLogSink = (entry) => {
  // eslint-disable-next-line no-console
  console.info('[provider]', {
    requestId: entry.requestId,
    provider: entry.provider,
    operation: entry.operation,
    durationMs: entry.durationMs,
    status: entry.status,
    httpStatus: entry.httpStatus ?? undefined,
    detail: entry.detail ?? undefined,
  })
}

export function setProviderLogSink(next: ProviderLogSink | null): void {
  sink =
    next ??
    ((entry) => {
      // eslint-disable-next-line no-console
      console.info('[provider]', {
        requestId: entry.requestId,
        provider: entry.provider,
        operation: entry.operation,
        durationMs: entry.durationMs,
        status: entry.status,
        httpStatus: entry.httpStatus ?? undefined,
        detail: entry.detail ?? undefined,
      })
    })
}

export function createProviderRequestId(prefix = 'prv'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

export function logProviderRequest(entry: ProviderLogEntry): void {
  sink({
    ...entry,
    detail: sanitizeDetail(entry.detail),
  })
}
