/**
 * Sprint 83 — Agent telemetry collector.
 */

import type { BrainV1ToolId } from '../types'
import type {
  BrainAgentId,
  BrainAgentLifecycle,
  BrainAgentOrchestratorTelemetry,
  BrainAgentSelection,
  BrainAgentTelemetryEvent,
  BrainAgentFailureKind,
} from './types'

export class AgentTelemetryCollector {
  private readonly events: BrainAgentTelemetryEvent[] = []
  private plannerDecisions: BrainAgentSelection[] = []
  private parallelBatches: BrainAgentId[][] = []
  private startedAt = 0

  start(): void {
    this.startedAt = Date.now()
  }

  setPlannerDecisions(decisions: BrainAgentSelection[]): void {
    this.plannerDecisions = [...decisions]
  }

  setParallelBatches(batches: BrainAgentId[][]): void {
    this.parallelBatches = batches.map((b) => [...b])
  }

  beginEvent(agentId: BrainAgentId, selectedTools: BrainV1ToolId[] = []): BrainAgentTelemetryEvent {
    const event: BrainAgentTelemetryEvent = {
      agentId,
      lifecycle: 'executing',
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: 0,
      attempts: 0,
      retries: 0,
      failures: [],
      selectedTools: [...selectedTools],
      ok: false,
      detail: '',
    }
    this.events.push(event)
    return event
  }

  recordAttempt(event: BrainAgentTelemetryEvent): void {
    event.attempts += 1
    if (event.attempts > 1) event.retries += 1
  }

  recordFailure(
    event: BrainAgentTelemetryEvent,
    kind: BrainAgentFailureKind,
    detail: string,
  ): void {
    event.failures.push({ kind, detail })
    event.lifecycle = 'recovering'
  }

  finishEvent(
    event: BrainAgentTelemetryEvent,
    lifecycle: BrainAgentLifecycle,
    ok: boolean,
    detail: string,
  ): void {
    event.endedAt = new Date().toISOString()
    event.durationMs = Math.max(
      0,
      new Date(event.endedAt).getTime() - new Date(event.startedAt).getTime(),
    )
    event.lifecycle = lifecycle
    event.ok = ok
    event.detail = detail
  }

  snapshot(selectedTools: BrainV1ToolId[] = []): BrainAgentOrchestratorTelemetry {
    const failures = this.events.reduce((n, e) => n + e.failures.length, 0)
    const retries = this.events.reduce((n, e) => n + e.retries, 0)
    return {
      totalDurationMs: this.startedAt ? Date.now() - this.startedAt : 0,
      events: this.events.map((e) => ({
        ...e,
        failures: [...e.failures],
        selectedTools: e.selectedTools.length ? e.selectedTools : [...selectedTools],
      })),
      plannerDecisions: [...this.plannerDecisions],
      parallelBatches: this.parallelBatches.map((b) => [...b]),
      failures,
      retries,
    }
  }
}

export function createAgentTelemetryCollector(): AgentTelemetryCollector {
  return new AgentTelemetryCollector()
}
