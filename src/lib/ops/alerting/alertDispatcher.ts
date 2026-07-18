/**
 * Phase AA — provider-neutral alert dispatcher with deterministic mock sink.
 */

import { getCorrelationId } from '../logging/correlation'
import { maskMetadata } from '../logging/mask'
import type { AlertEvent, AlertSink } from './types'

export class MockAlertDispatcher implements AlertSink {
  private readonly events: AlertEvent[] = []

  dispatch(alert: AlertEvent): void {
    this.events.push({
      ...alert,
      correlationId: alert.correlationId ?? getCorrelationId(),
      metadata: maskMetadata(alert.metadata as Record<string, unknown>),
    })
  }

  list(): AlertEvent[] {
    return this.events.map((e) => ({ ...e, metadata: { ...e.metadata } }))
  }

  clear(): void {
    this.events.length = 0
  }
}

export class CompositeAlertDispatcher implements AlertSink {
  private readonly sinks: AlertSink[]

  constructor(sinks: AlertSink[]) {
    this.sinks = sinks
  }

  async dispatch(alert: AlertEvent): Promise<void> {
    const masked = {
      ...alert,
      correlationId: alert.correlationId ?? getCorrelationId(),
      metadata: maskMetadata(alert.metadata as Record<string, unknown>),
    }
    for (const sink of this.sinks) {
      await sink.dispatch(masked)
    }
  }
}

let defaultDispatcher: AlertSink | null = null

export function getAlertDispatcher(): AlertSink {
  if (!defaultDispatcher) defaultDispatcher = new MockAlertDispatcher()
  return defaultDispatcher
}

export function setAlertDispatcher(sink: AlertSink): void {
  defaultDispatcher = sink
}

export function resetAlertDispatcher(): void {
  if (defaultDispatcher instanceof MockAlertDispatcher) {
    defaultDispatcher.clear()
  }
  defaultDispatcher = null
}

export async function dispatchAlerts(alerts: AlertEvent[]): Promise<void> {
  const dispatcher = getAlertDispatcher()
  for (const alert of alerts) {
    await dispatcher.dispatch(alert)
  }
}
