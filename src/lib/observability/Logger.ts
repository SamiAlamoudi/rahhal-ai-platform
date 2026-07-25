/**
 * Sprint 15 — structured Logger (sanitized; never secrets/PII/payment).
 */

import { sanitizeForLogs } from '../security/secrets/SecretSanitizer'
import { getCorrelationIdManager } from './CorrelationIdManager'
import { isObservabilityPlatformEnabled } from './feature'
import type { LogLevel, StructuredLogRecord } from './types'

const LEVEL_ORDER: Record<LogLevel, number> = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
}

const FORBIDDEN_FIELD =
  /^(password|passwd|secret|token|api[_-]?key|authorization|cookie|card|cvv|pan|ssn|email|phone|national[_-]?id|payment)/i

export interface LoggerOptions {
  enabled?: boolean
  minLevel?: LogLevel
  module?: string
  sink?: (record: StructuredLogRecord) => void
}

export class Logger {
  private readonly enabledOverride: boolean | undefined
  private readonly minLevel: LogLevel
  private readonly defaultModule: string | null
  private readonly sink: (record: StructuredLogRecord) => void
  private readonly buffer: StructuredLogRecord[] = []
  private static readonly MAX_BUFFER = 500

  constructor(options: LoggerOptions = {}) {
    this.enabledOverride = options.enabled
    this.minLevel = options.minLevel ?? 'INFO'
    this.defaultModule = options.module ?? null
    this.sink = options.sink ?? (() => undefined)
  }

  isEnabled(): boolean {
    return isObservabilityPlatformEnabled({ enabled: this.enabledOverride })
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isEnabled()) return false
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel]
  }

  private scrubFields(fields?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!fields) return undefined
    const sanitized = sanitizeForLogs(fields) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(sanitized)) {
      if (FORBIDDEN_FIELD.test(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = v
      }
    }
    return out
  }

  log(
    level: LogLevel,
    message: string,
    options?: {
      durationMs?: number | null
      status?: string | null
      fields?: Record<string, unknown>
      module?: string
      provider?: string
    },
  ): StructuredLogRecord | null {
    if (!this.shouldLog(level)) return null
    const ctx = getCorrelationIdManager().current()
    const safeMessage = String(sanitizeForLogs(message) ?? message)
    const record: StructuredLogRecord = {
      level,
      message: safeMessage,
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      conversationId: ctx.conversationId,
      provider: options?.provider ?? ctx.provider,
      module: options?.module ?? this.defaultModule ?? ctx.module,
      durationMs: options?.durationMs ?? null,
      status: options?.status ?? null,
      fields: this.scrubFields(options?.fields),
    }
    this.buffer.push(record)
    if (this.buffer.length > Logger.MAX_BUFFER) this.buffer.splice(0, this.buffer.length - Logger.MAX_BUFFER)
    this.sink(record)
    return record
  }

  trace(message: string, opts?: Parameters<Logger['log']>[2]) { return this.log('TRACE', message, opts) }
  debug(message: string, opts?: Parameters<Logger['log']>[2]) { return this.log('DEBUG', message, opts) }
  info(message: string, opts?: Parameters<Logger['log']>[2]) { return this.log('INFO', message, opts) }
  warn(message: string, opts?: Parameters<Logger['log']>[2]) { return this.log('WARN', message, opts) }
  error(message: string, opts?: Parameters<Logger['log']>[2]) { return this.log('ERROR', message, opts) }
  fatal(message: string, opts?: Parameters<Logger['log']>[2]) { return this.log('FATAL', message, opts) }

  list(): StructuredLogRecord[] {
    return [...this.buffer]
  }

  clear(): void {
    this.buffer.length = 0
  }

  /** Assert no forbidden material appears in buffered logs. */
  assertNoSensitiveLeaks(secrets: string[] = []): void {
    const text = JSON.stringify(this.buffer)
    for (const secret of secrets) {
      if (secret && secret.length >= 6 && text.includes(secret)) {
        throw new Error('Sensitive material must never appear in logs')
      }
    }
    if (/\bsk-[A-Za-z0-9]{16,}\b/.test(text)) {
      throw new Error('API key material must never appear in logs')
    }
  }
}

let sharedLogger: Logger | null = null

export function getLogger(options?: LoggerOptions): Logger {
  if (options) return new Logger(options)
  if (!sharedLogger) sharedLogger = new Logger()
  return sharedLogger
}

export function resetLoggerForTests(): void {
  sharedLogger?.clear()
  sharedLogger = null
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options)
}
