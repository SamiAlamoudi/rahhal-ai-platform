/**
 * Sprint 115 — PipelineLogger
 */

export interface PipelineLogEntry {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
}

export type PipelineStructuredLogger = (entry: PipelineLogEntry) => void

export function createSilentPipelineLogger(): PipelineStructuredLogger {
  return () => {
    /* retained on runner */
  }
}

export class PipelineLogger {
  private readonly sink: PipelineStructuredLogger
  private readonly entries: PipelineLogEntry[] = []

  constructor(sink?: PipelineStructuredLogger) {
    this.sink = sink ?? createSilentPipelineLogger()
  }

  emit(
    level: PipelineLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: PipelineLogEntry = {
      at: new Date().toISOString(),
      level,
      message,
      meta,
    }
    this.entries.push(entry)
    this.sink(entry)
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta)
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.emit('error', message, meta)
  }

  getEntries(): readonly PipelineLogEntry[] {
    return this.entries.slice()
  }

  messages(): string[] {
    return this.entries.map((e) => e.message)
  }

  clear(): void {
    this.entries.length = 0
  }
}

export function createPipelineLogger(
  sink?: PipelineStructuredLogger,
): PipelineLogger {
  return new PipelineLogger(sink)
}
