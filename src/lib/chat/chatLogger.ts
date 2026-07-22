import { extractErrorText } from '../ops/errors/canonicalError'

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
  const message = extractErrorText(error, 'unknown_error')
  if (message === 'cancelled' || message === 'aborted' || message.includes('تم إيقاف')) {
    logChat('debug', scope, message, context)
    return
  }
  logChat('error', scope, message, { error, ...context })
}

export function isBenignChatError(error: unknown): boolean {
  const message = typeof error === 'string'
    ? error
    : extractErrorText(error, '')
  const normalized = message.toLowerCase()
  return (
    normalized === 'cancelled'
    || normalized === 'aborted'
    || normalized.includes('interrupted')
    || normalized.includes('تم إيقاف')
  )
}
