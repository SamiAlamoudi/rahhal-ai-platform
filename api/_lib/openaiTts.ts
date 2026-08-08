/**
 * Shared OpenAI classic TTS helpers — safe diagnostics, no secrets in outputs.
 */

export type TtsSafeCode =
  | 'TTS_CONFIG_MISSING'
  | 'TTS_AUTH_FAILED'
  | 'TTS_UPSTREAM_400'
  | 'TTS_UPSTREAM_401'
  | 'TTS_UPSTREAM_403'
  | 'TTS_UPSTREAM_429'
  | 'TTS_UPSTREAM_5XX'
  | 'TTS_UPSTREAM_TIMEOUT'
  | 'TTS_UPSTREAM_NETWORK'
  | 'TTS_INVALID_CONTENT_TYPE'
  | 'TTS_EMPTY_RESPONSE'
  | 'TTS_RESPONSE_CONVERSION_FAILED'
  | 'TTS_RESPONSE_READY'

export type TtsDiagStage =
  | 'TTS_ROUTE_ENTERED'
  | 'TTS_AUTH_OK'
  | 'TTS_ENV_KEY_PRESENT'
  | 'TTS_ENV_KEY_MISSING'
  | 'TTS_UPSTREAM_REQUEST_STARTED'
  | `TTS_MODEL_${string}`
  | `TTS_VOICE_${string}`
  | `TTS_FORMAT_${string}`
  | `TTS_UPSTREAM_STATUS_${number | string}`
  | `TTS_UPSTREAM_ERROR_CODE_${string}`
  | `TTS_UPSTREAM_CONTENT_TYPE_${string}`
  | `TTS_UPSTREAM_BYTES_${number}`
  | 'TTS_RESPONSE_READY'

const ALLOWED_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'fable',
  'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse',
])

const ALLOWED_FORMATS = new Set(['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'])

/** OpenAI secret present + plausible shape (never log the value). */
export function classifyOpenAiKey(apiKey: string | null | undefined): {
  present: boolean
  plausible: boolean
} {
  const raw = (apiKey ?? '').trim()
  if (!raw) return { present: false, plausible: false }
  // Current OpenAI secrets start with sk- (incl. sk-proj-…). Reject placeholders.
  const plausible =
    /^sk-[A-Za-z0-9_-]{10,}$/.test(raw)
    && !/^\[.*\]$/.test(raw)
    && raw.toLowerCase() !== 'sensitive'
    && raw.toLowerCase() !== 'redacted'
  return { present: true, plausible }
}

export function resolveTtsVoice(input: {
  requestedVoice?: string
  envVoice?: string
  locale: 'ar' | 'en'
}): string {
  const requested = (input.requestedVoice || '').trim().toLowerCase()
  if (ALLOWED_VOICES.has(requested)) return requested
  const envVoice = (input.envVoice || '').trim().toLowerCase()
  if (ALLOWED_VOICES.has(envVoice)) return envVoice
  return input.locale === 'ar' ? 'coral' : 'nova'
}

export function resolveTtsFormat(requestedFormat?: string): string {
  const fmt = (requestedFormat || '').trim().toLowerCase()
  return ALLOWED_FORMATS.has(fmt) ? fmt : 'wav'
}

export function contentTypeForFormat(format: string): string {
  switch (format) {
    case 'wav':
      return 'audio/wav'
    case 'opus':
      return 'audio/ogg'
    case 'aac':
      return 'audio/aac'
    case 'flac':
      return 'audio/flac'
    case 'pcm':
      return 'audio/pcm'
    default:
      return 'audio/mpeg'
  }
}

export function mapUpstreamStatusToSafeCode(status: number): TtsSafeCode {
  if (status === 400) return 'TTS_UPSTREAM_400'
  if (status === 401) return 'TTS_UPSTREAM_401'
  if (status === 403) return 'TTS_UPSTREAM_403'
  if (status === 429) return 'TTS_UPSTREAM_429'
  if (status >= 500) return 'TTS_UPSTREAM_5XX'
  if (status >= 400) return 'TTS_UPSTREAM_400'
  return 'TTS_UPSTREAM_5XX'
}

/** Prefer OpenAI error.code / error.type; never return secrets. */
export function extractUpstreamSafeErrorCode(detail: string): string | null {
  try {
    const parsed = JSON.parse(detail) as {
      error?: { code?: unknown; type?: unknown }
      code?: unknown
    }
    const candidates = [
      parsed.error?.code,
      parsed.error?.type,
      parsed.code,
    ]
    for (const c of candidates) {
      if (typeof c === 'string') {
        const cleaned = c.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 48)
        if (cleaned) return cleaned
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Redact anything that looks like a secret from upstream snippets. */
export function sanitizeUpstreamDetail(detail: string, max = 240): string {
  return detail
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, max)
}

export function httpStatusForSafeCode(code: TtsSafeCode): number {
  switch (code) {
    case 'TTS_CONFIG_MISSING':
      return 503
    case 'TTS_AUTH_FAILED':
    case 'TTS_UPSTREAM_401':
      return 401
    case 'TTS_UPSTREAM_403':
      return 403
    case 'TTS_UPSTREAM_429':
      return 429
    case 'TTS_UPSTREAM_400':
    case 'TTS_INVALID_CONTENT_TYPE':
    case 'TTS_EMPTY_RESPONSE':
    case 'TTS_RESPONSE_CONVERSION_FAILED':
      return 502
    case 'TTS_UPSTREAM_TIMEOUT':
    case 'TTS_UPSTREAM_NETWORK':
    case 'TTS_UPSTREAM_5XX':
      return 502
    default:
      return 502
  }
}

export function isAudioContentType(contentType: string | null | undefined): boolean {
  const ct = (contentType || '').toLowerCase()
  return ct.startsWith('audio/') || ct.includes('octet-stream')
}

export function looksLikeJsonBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 2) return false
  // Skip UTF-8 BOM
  let i = 0
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3
  while (i < bytes.byteLength && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09)) {
    i += 1
  }
  return bytes[i] === 0x7b /* { */ || bytes[i] === 0x5b /* [ */
}

export function defaultArabicInstructions(dialect?: string): string {
  const dialectHint = (() => {
    switch (dialect) {
      case 'white':
        return 'Use clear widely understood modern Arabic (العربية البيضاء).'
      case 'saudi':
        return 'Prefer natural Saudi phrasing and rhythm when comfortable; stay clear — never caricature.'
      case 'gulf':
        return 'Prefer natural Gulf phrasing when comfortable; stay clear — never caricature.'
      case 'moroccan':
        return 'Light Moroccan coloring only if clear; otherwise use clear natural Arabic (not heavy Darija imitation).'
      case 'fusha':
        return 'Use clear simplified Modern Standard Arabic — warm and conversational, not classical oratory.'
      default:
        return 'Prefer natural Saudi/Gulf conversational Arabic when comfortable; fall back to clear Arabic if unsure.'
    }
  })()

  return [
    'Speak naturally and conversationally as Bilamo, an experienced travel consultant on a live voice call.',
    'Warm, confident, calm, concise. Avoid announcer-style delivery and exaggerated emotion.',
    'Use natural pauses. Keep volume, tone, and pace consistent throughout.',
    'Do not sound like a navigation system or text reader.',
    dialectHint,
    'If a strong regional accent would sound unnatural, use clear natural Arabic instead of a poor imitation.',
    'Absolutely no English words.',
  ].join(' ')
}

export function defaultEnglishInstructions(): string {
  return [
    'Speak naturally and conversationally as an experienced travel consultant.',
    'Warm, confident, calm. Avoid announcer-style delivery and exaggerated emotion.',
    'Use natural pauses. Keep volume, tone, and pace consistent.',
    'Do not sound like a navigation system or text reader.',
  ].join(' ')
}

export { ALLOWED_VOICES, ALLOWED_FORMATS }
