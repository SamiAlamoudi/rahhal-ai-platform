/**
 * Phase AI — OpenTelemetry tracing hooks (optional, dependency-free).
 *
 * Default: no-op spans. When a tracer provider is registered (tests or a future
 * OTel SDK), spans are forwarded without bundling OpenTelemetry by default.
 */

import { getCorrelationId } from '../logging/correlation'

export interface TraceSpan {
  name: string
  traceId: string
  spanId: string
  setAttribute(key: string, value: string | number | boolean): void
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void
  recordException(error: unknown): void
  end(): void
}

export interface TracerProvider {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): TraceSpan
}

class NoopSpan implements TraceSpan {
  readonly name: string
  readonly traceId: string
  readonly spanId: string
  private readonly attributes: Record<string, string | number | boolean> = {}

  constructor(name: string) {
    this.name = name
    this.traceId = getCorrelationId()
    this.spanId = `span_${Math.random().toString(36).slice(2, 10)}`
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value
  }

  addEvent(_name: string, _attributes?: Record<string, string | number | boolean>): void {
    /* no-op */
  }

  recordException(_error: unknown): void {
    /* no-op */
  }

  end(): void {
    /* no-op */
  }
}

class NoopTracerProvider implements TracerProvider {
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): TraceSpan {
    const span = new NoopSpan(name)
    if (attributes) {
      for (const [k, v] of Object.entries(attributes)) span.setAttribute(k, v)
    }
    span.setAttribute('correlation.id', getCorrelationId())
    return span
  }
}

/** In-memory recording provider for tests / light observability. */
export class RecordingTracerProvider implements TracerProvider {
  readonly spans: Array<{
    name: string
    attributes: Record<string, string | number | boolean>
    events: string[]
    exceptions: string[]
    ended: boolean
  }> = []

  startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): TraceSpan {
    const record = {
      name,
      attributes: { ...attributes, 'correlation.id': getCorrelationId() },
      events: [] as string[],
      exceptions: [] as string[],
      ended: false,
    }
    this.spans.push(record)
    return {
      name,
      traceId: String(record.attributes['correlation.id'] ?? ''),
      spanId: `span_${this.spans.length}`,
      setAttribute(key, value) {
        record.attributes[key] = value
      },
      addEvent(eventName) {
        record.events.push(eventName)
      },
      recordException(error) {
        record.exceptions.push(error instanceof Error ? error.message : String(error))
      },
      end() {
        record.ended = true
      },
    }
  }
}

let provider: TracerProvider = new NoopTracerProvider()

export function setTracerProvider(next: TracerProvider | null): void {
  provider = next ?? new NoopTracerProvider()
}

export function getTracerProvider(): TracerProvider {
  return provider
}

export function startSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): TraceSpan {
  return provider.startSpan(name, attributes)
}

export async function withSpan<T>(
  name: string,
  fn: (span: TraceSpan) => Promise<T> | T,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const span = startSpan(name, attributes)
  try {
    const result = await fn(span)
    span.setAttribute('otel.status_code', 'OK')
    return result
  } catch (error) {
    span.recordException(error)
    span.setAttribute('otel.status_code', 'ERROR')
    throw error
  } finally {
    span.end()
  }
}

export function resetTracerProvider(): void {
  provider = new NoopTracerProvider()
}
