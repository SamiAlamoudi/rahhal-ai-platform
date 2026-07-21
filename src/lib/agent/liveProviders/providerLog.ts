/**
 * Structured provider logging — never logs secrets.
 */

export type ProviderLogEntry = {
  requestId: string
  provider: string
  operation: string
  durationMs: number
  status: string
  bookingId?: string | null
  providerReference?: string | null
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
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[redacted]')
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
    bookingId: entry.bookingId ?? undefined,
    providerReference: entry.providerReference ?? undefined,
    httpStatus: entry.httpStatus ?? undefined,
    detail: entry.detail ?? undefined,
  })
}

export function setProviderLogSink(next: ProviderLogSink | null): void {
  sink = next ?? sink
}

export function createProviderRequestId(prefix = 'prv'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function logProviderRequest(entry: ProviderLogEntry): void {
  sink({
    ...entry,
    detail: sanitizeDetail(entry.detail),
  })
}
