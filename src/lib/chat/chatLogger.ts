type LogLevel = 'debug' | 'warn' | 'error'

const PREFIX = '[rahhal-chat]'

export function logChat(
  level: LogLevel,
  scope: string,
  message: string,
  detail?: unknown,
): void {
  const payload = detail === undefined ? `${PREFIX} ${scope}: ${message}` : [`${PREFIX} ${scope}: ${message}`, detail]
  if (level === 'debug') {
    // Prefer debug so production consoles stay quiet unless enabled
    console.debug(...(Array.isArray(payload) ? payload : [payload]))
    return
  }
  if (level === 'warn') {
    console.warn(...(Array.isArray(payload) ? payload : [payload]))
    return
  }
  console.error(...(Array.isArray(payload) ? payload : [payload]))
}

export function logChatError(scope: string, error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
  if (message === 'cancelled' || message === 'aborted' || message.includes('تم إيقاف')) {
    logChat('debug', scope, message, context)
    return
  }
  logChat('error', scope, message, { error, ...context })
}

export function isBenignChatError(error: unknown): boolean {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''
  const normalized = message.toLowerCase()
  return (
    normalized === 'cancelled'
    || normalized === 'aborted'
    || normalized.includes('interrupted')
    || normalized.includes('تم إيقاف')
    // Realtime cancel noise when no response is active — never user-facing.
    || normalized.includes('cancellation failed')
    || normalized.includes('no active response')
    // Headless / no-mic environments — never show raw browser chrome to travelers.
    || normalized.includes('requested device not found')
    || normalized.includes('device not found')
    || normalized.includes('notfounderror')
  )
}
