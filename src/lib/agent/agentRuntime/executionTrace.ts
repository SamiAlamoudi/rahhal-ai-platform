/**
 * Phase 6 — ExecutionTrace
 */

import type { ExecutionTraceStep } from './types'

export class ExecutionTrace {
  private readonly steps: ExecutionTraceStep[] = []
  private readonly startedAt = Date.now()

  mark(stage: string, detail: string): void {
    this.steps.push({
      stage,
      detail,
      at: new Date().toISOString(),
      durationMs: Date.now() - this.startedAt,
    })
  }

  list(): ExecutionTraceStep[] {
    return this.steps.slice()
  }

  elapsedMs(): number {
    return Date.now() - this.startedAt
  }
}
