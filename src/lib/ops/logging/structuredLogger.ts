/**
 * Structured JSON logger — Phase X.
 * Emits one JSON object per line; metadata is masked.
 */

import { getCorrelationId } from './correlation'
import { assertNoSecretsInText, maskMetadata } from './mask'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface StructuredLogEvent {
  ts: string
  level: LogLevel
  message: string
  correlationId: string
  domain: string
  operation: string
  durationMs: number | null
  success: boolean | null
  metadata: Record<string, unknown>
}

export interface LoggerOptions {
  sink?: (line: string) => void
  minLevel?: LogLevel
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function defaultSink(line: string): void {
  // eslint-disable-next-line no-console
  console.info(line)
}

export class StructuredLogger {
  private readonly sink: (line: string) => void
  private readonly minLevel: LogLevel
  private readonly buffer: StructuredLogEvent[] = []

  constructor(options: LoggerOptions = {}) {
    this.sink = options.sink ?? defaultSink
    this.minLevel = options.minLevel ?? 'info'
  }

  log(input: {
    level: LogLevel
    message: string
    domain: string
    operation: string
    durationMs?: number | null
    success?: boolean | null
    metadata?: Record<string, unknown>
    correlationId?: string
  }): StructuredLogEvent {
    const event: StructuredLogEvent = {
      ts: new Date().toISOString(),
      level: input.level,
      message: input.message,
      correlationId: input.correlationId ?? getCorrelationId(),
      domain: input.domain,
      operation: input.operation,
      durationMs: input.durationMs ?? null,
      success: input.success ?? null,
      metadata: maskMetadata(input.metadata),
    }

    if (LEVEL_RANK[event.level] < LEVEL_RANK[this.minLevel]) {
      return event
    }

    const line = JSON.stringify(event)
    if (!assertNoSecretsInText(line)) {
      const safe = JSON.stringify({
        ...event,
        message: '[message redacted — potential secret]',
        metadata: { redacted: true },
      })
      this.sink(safe)
      this.buffer.push(event)
      return event
    }

    this.sink(line)
    this.buffer.push(event)
    if (this.buffer.length > 500) this.buffer.shift()
    return event
  }

  info(domain: string, operation: string, message: string, metadata?: Record<string, unknown>) {
    return this.log({ level: 'info', domain, operation, message, metadata })
  }

  warn(domain: string, operation: string, message: string, metadata?: Record<string, unknown>) {
    return this.log({ level: 'warn', domain, operation, message, metadata })
  }

  error(domain: string, operation: string, message: string, metadata?: Record<string, unknown>) {
    return this.log({ level: 'error', domain, operation, message, success: false, metadata })
  }

  operation<T>(
    domain: string,
    operation: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> | T {
    const started = Date.now()
    try {
      const result = fn()
      if (result && typeof (result as Promise<T>).then === 'function') {
        return (result as Promise<T>).then(
          (value) => {
            this.log({
              level: 'info',
              domain,
              operation,
              message: `${operation} succeeded`,
              durationMs: Date.now() - started,
              success: true,
              metadata,
            })
            return value
          },
          (err) => {
            this.log({
              level: 'error',
              domain,
              operation,
              message: err instanceof Error ? err.message : String(err),
              durationMs: Date.now() - started,
              success: false,
              metadata,
            })
            throw err
          },
        )
      }
      this.log({
        level: 'info',
        domain,
        operation,
        message: `${operation} succeeded`,
        durationMs: Date.now() - started,
        success: true,
        metadata,
      })
      return result
    } catch (err) {
      this.log({
        level: 'error',
        domain,
        operation,
        message: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
        success: false,
        metadata,
      })
      throw err
    }
  }

  recent(limit = 50): StructuredLogEvent[] {
    return this.buffer.slice(-limit)
  }

  clear(): void {
    this.buffer.length = 0
  }
}

let defaultLogger: StructuredLogger | null = null

export function getLogger(): StructuredLogger {
  if (!defaultLogger) defaultLogger = new StructuredLogger()
  return defaultLogger
}

export function resetLogger(): void {
  defaultLogger = null
}
