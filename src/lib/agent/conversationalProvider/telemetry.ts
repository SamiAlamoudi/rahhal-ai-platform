/**
 * Sprint 80 P1-4 — Live flight provider pilot telemetry.
 * Records provider selection, fallback, latency, and success/failure.
 * No secrets / no user-facing error strings.
 */

export type FlightPilotTelemetryEvent = {
  at: string
  providerSelected: string | null
  fallbackTriggered: boolean
  latencyMs: number
  ok: boolean
  errorCode?: string | null
  mode?: 'live' | 'legacy' | 'unavailable'
}

export type FlightPilotTelemetrySnapshot = {
  searches: number
  successes: number
  failures: number
  fallbacks: number
  totalLatencyMs: number
  averageLatencyMs: number
  byProvider: Record<string, number>
  lastEvent: FlightPilotTelemetryEvent | null
  events: FlightPilotTelemetryEvent[]
}

const MAX_EVENTS = 50

export class FlightPilotTelemetry {
  private searches = 0
  private successes = 0
  private failures = 0
  private fallbacks = 0
  private totalLatencyMs = 0
  private byProvider: Record<string, number> = {}
  private events: FlightPilotTelemetryEvent[] = []

  record(input: {
    providerSelected: string | null
    fallbackTriggered: boolean
    latencyMs: number
    ok: boolean
    errorCode?: string | null
    mode?: FlightPilotTelemetryEvent['mode']
  }): FlightPilotTelemetryEvent {
    const event: FlightPilotTelemetryEvent = {
      at: new Date().toISOString(),
      providerSelected: input.providerSelected,
      fallbackTriggered: input.fallbackTriggered,
      latencyMs: Math.max(0, input.latencyMs),
      ok: input.ok,
      errorCode: input.errorCode ?? null,
      mode: input.mode,
    }

    this.searches += 1
    this.totalLatencyMs += event.latencyMs
    if (input.ok) this.successes += 1
    else this.failures += 1
    if (input.fallbackTriggered) this.fallbacks += 1
    if (input.providerSelected) {
      this.byProvider[input.providerSelected] =
        (this.byProvider[input.providerSelected] ?? 0) + 1
    }

    this.events.push(event)
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS)
    }
    return event
  }

  snapshot(): FlightPilotTelemetrySnapshot {
    const searches = this.searches
    return {
      searches,
      successes: this.successes,
      failures: this.failures,
      fallbacks: this.fallbacks,
      totalLatencyMs: this.totalLatencyMs,
      averageLatencyMs: searches === 0
        ? 0
        : Math.round((this.totalLatencyMs / searches) * 100) / 100,
      byProvider: { ...this.byProvider },
      lastEvent: this.events[this.events.length - 1] ?? null,
      events: [...this.events],
    }
  }

  reset(): void {
    this.searches = 0
    this.successes = 0
    this.failures = 0
    this.fallbacks = 0
    this.totalLatencyMs = 0
    this.byProvider = {}
    this.events = []
  }
}

let sharedTelemetry: FlightPilotTelemetry | null = null

export function getFlightPilotTelemetry(): FlightPilotTelemetry {
  if (!sharedTelemetry) sharedTelemetry = new FlightPilotTelemetry()
  return sharedTelemetry
}

export function resetFlightPilotTelemetry(): void {
  sharedTelemetry?.reset()
  sharedTelemetry = null
}

export function createFlightPilotTelemetry(): FlightPilotTelemetry {
  return new FlightPilotTelemetry()
}
