/**
 * Maps Realtime / WebRTC / HTTP failures to a single traveler-safe Arabic message.
 * Technical details must never appear in red UI copy.
 */

export const VOICE_RECOVERABLE_ERROR_AR =
  'تعذر إكمال المحادثة الصوتية. حاول مرة أخرى.'

const TECHNICAL_MARKERS = [
  'cancellation failed',
  'no active response',
  'active response found',
  'webrtc',
  'sdp',
  'openai',
  'realtime',
  'http',
  'fetch',
  'websocket',
  'ice ',
  'dtls',
  'response.cancel',
  'output_audio_buffer',
  'status code',
  'networkerror',
  'typeerror',
  'abortError',
  'notallowederror',
]

/** Harmless server noise — never surface, never treat as session failure. */
export function isHarmlessRealtimeCancelError(message: string): boolean {
  const m = (message || '').toLowerCase()
  return (
    m.includes('cancellation failed')
    || m.includes('no active response')
    || (m.includes('cancel') && m.includes('no active'))
  )
}

export function isTechnicalVoiceErrorMessage(message: string): boolean {
  const m = (message || '').toLowerCase()
  if (!m.trim()) return false
  if (isHarmlessRealtimeCancelError(m)) return true
  return TECHNICAL_MARKERS.some((marker) => m.includes(marker))
}

/**
 * Returns null for benign/cancel noise (caller should no-op).
 * Returns the safe Arabic string for any other failure.
 */
export function toUserFacingVoiceError(error: unknown): string | null {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : String(error ?? '')

  if (!message.trim()) return null
  if (isHarmlessRealtimeCancelError(message)) return null

  // Already the safe copy
  if (message === VOICE_RECOVERABLE_ERROR_AR) return message

  // Any technical or unknown voice failure → safe Arabic only
  if (isTechnicalVoiceErrorMessage(message) || /[A-Za-z]{4,}/.test(message)) {
    return VOICE_RECOVERABLE_ERROR_AR
  }

  // Short Arabic operational messages (mic permission, etc.) may pass through
  // if they do not look technical.
  if (/[\u0600-\u06FF]/.test(message) && message.length < 120) {
    return message
  }

  return VOICE_RECOVERABLE_ERROR_AR
}
