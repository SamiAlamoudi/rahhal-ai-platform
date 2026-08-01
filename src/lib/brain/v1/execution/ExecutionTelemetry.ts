/**
 * Sprint 85 — Execution telemetry collector.
 */

import type {
  ExecutableToolType,
  ExecutionPolicyKind,
  ExecutionTelemetry,
  ExecutionTelemetryEvent,
  ToolExecutionStatus,
} from './types'

export class ExecutionTelemetryCollector {
  private readonly events: ExecutionTelemetryEvent[] = []
  private parallelBatches: ExecutableToolType[][] = []
  private startedAt = 0

  start(): void {
    this.startedAt = Date.now()
  }

  setBatches(batches: ExecutableToolType[][]): void {
    this.parallelBatches = batches.map((b) => [...b])
  }

  begin(
    tool: ExecutableToolType,
    policy: ExecutionPolicyKind,
  ): ExecutionTelemetryEvent {
    const event: ExecutionTelemetryEvent = {
      tool,
      selected: true,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: 0,
      attempts: 0,
      retries: 0,
      failures: [],
      fallbackUsed: null,
      success: false,
      status: 'running',
      policy,
    }
    this.events.push(event)
    return event
  }

  recordAttempt(event: ExecutionTelemetryEvent): void {
    event.attempts += 1
    if (event.attempts > 1) event.retries += 1
  }

  recordFailure(event: ExecutionTelemetryEvent, detail: string): void {
    event.failures.push(detail)
  }

  finish(
    event: ExecutionTelemetryEvent,
    status: ToolExecutionStatus,
    success: boolean,
    fallbackUsed: ExecutableToolType | null = null,
  ): void {
    event.endedAt = new Date().toISOString()
    event.durationMs = Math.max(
      0,
      new Date(event.endedAt).getTime() - new Date(event.startedAt).getTime(),
    )
    event.status = status
    event.success = success
    event.fallbackUsed = fallbackUsed
  }

  snapshot(): ExecutionTelemetry {
    return {
      totalDurationMs: this.startedAt ? Date.now() - this.startedAt : 0,
      events: this.events.map((e) => ({ ...e, failures: [...e.failures] })),
      parallelBatches: this.parallelBatches.map((b) => [...b]),
      failures: this.events.reduce((n, e) => n + e.failures.length, 0),
      retries: this.events.reduce((n, e) => n + e.retries, 0),
      fallbacks: this.events.filter((e) => e.fallbackUsed).length,
    }
  }
}

export function createExecutionTelemetryCollector(): ExecutionTelemetryCollector {
  return new ExecutionTelemetryCollector()
}
