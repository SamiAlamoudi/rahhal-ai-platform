/**
 * Sprint 33 — Structured execution logger (in-memory buffer).
 */

export type ExecutionLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface ExecutionLogEntry {
  at: string
  level: ExecutionLogLevel
  sessionId: string | null
  message: string
  data?: Record<string, unknown>
}

export class ExecutionLogger {
  private readonly entries: ExecutionLogEntry[] = []

  log(
    level: ExecutionLogLevel,
    message: string,
    sessionId: string | null = null,
    data?: Record<string, unknown>,
  ): void {
    this.entries.push({
      at: new Date().toISOString(),
      level,
      sessionId,
      message,
      data,
    })
  }

  info(message: string, sessionId?: string | null, data?: Record<string, unknown>): void {
    this.log('info', message, sessionId ?? null, data)
  }

  warn(message: string, sessionId?: string | null, data?: Record<string, unknown>): void {
    this.log('warn', message, sessionId ?? null, data)
  }

  error(message: string, sessionId?: string | null, data?: Record<string, unknown>): void {
    this.log('error', message, sessionId ?? null, data)
  }

  list(): ExecutionLogEntry[] {
    return [...this.entries]
  }

  clear(): void {
    this.entries.length = 0
  }
}
