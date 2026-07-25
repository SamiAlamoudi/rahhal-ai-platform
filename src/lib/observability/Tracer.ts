/**
 * Sprint 15 — distributed Tracer (full request lifecycle spans).
 * Additive only — does not modify Conversation Brain / Journey / Planner engines.
 */

import { getCorrelationIdManager } from './CorrelationIdManager'
import { isObservabilityPlatformEnabled } from './feature'
import { getMetricsCollector, type MetricsCollector } from './MetricsCollector'
import type { TraceDomain, TraceRecord, TraceSpan } from './types'

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const LIFECYCLE_DOMAINS: TraceDomain[] = [
  'conversation',
  'planner',
  'journey',
  'providers',
  'maps',
  'flights',
  'hotels',
  'payments',
  'action_engine',
]

export class Tracer {
  private readonly enabledOverride: boolean | undefined
  private readonly metrics: MetricsCollector
  private readonly traces = new Map<string, TraceRecord>()
  private activeTraceId: string | null = null

  constructor(options?: { enabled?: boolean; metrics?: MetricsCollector }) {
    this.enabledOverride = options?.enabled
    this.metrics = options?.metrics ?? getMetricsCollector()
  }

  isEnabled(): boolean {
    return isObservabilityPlatformEnabled({ enabled: this.enabledOverride })
  }

  startTrace(options?: { conversationId?: string | null }): TraceRecord | null {
    if (!this.isEnabled()) return null
    const ctx = getCorrelationIdManager().current()
    const trace: TraceRecord = {
      traceId: id('tr'),
      requestId: ctx.requestId,
      conversationId: options?.conversationId ?? ctx.conversationId,
      spans: [],
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: null,
      totalDurationMs: null,
    }
    this.traces.set(trace.traceId, trace)
    this.activeTraceId = trace.traceId
    return trace
  }

  startSpan(
    name: string,
    domain: TraceDomain,
    options?: { parentSpanId?: string | null; attributes?: TraceSpan['attributes']; traceId?: string },
  ): TraceSpan | null {
    if (!this.isEnabled()) return null
    const traceId = options?.traceId ?? this.activeTraceId
    if (!traceId) return null
    const trace = this.traces.get(traceId)
    if (!trace) return null
    const span: TraceSpan = {
      spanId: id('sp'),
      parentSpanId: options?.parentSpanId ?? null,
      name,
      domain,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMs: null,
      status: 'running',
      attributes: options?.attributes ?? {},
    }
    trace.spans.push(span)
    return span
  }

  endSpan(
    spanId: string,
    options?: { status?: TraceSpan['status']; attributes?: TraceSpan['attributes'] },
  ): TraceSpan | null {
    if (!this.isEnabled()) return null
    for (const trace of this.traces.values()) {
      const span = trace.spans.find((s) => s.spanId === spanId)
      if (!span) continue
      const endedAt = new Date().toISOString()
      const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(span.startedAt))
      span.endedAt = endedAt
      span.durationMs = durationMs
      span.status = options?.status ?? 'ok'
      if (options?.attributes) span.attributes = { ...span.attributes, ...options.attributes }
      this.metrics.recordRequest(durationMs)
      if (span.status === 'timeout') {
        this.metrics.recordProviderTimeout(
          typeof span.attributes.provider === 'string' ? span.attributes.provider : undefined,
        )
      }
      if (span.status === 'error' && span.domain === 'providers') {
        this.metrics.recordProviderFailure(
          typeof span.attributes.provider === 'string' ? span.attributes.provider : undefined,
        )
      }
      return span
    }
    return null
  }

  endTrace(traceId?: string, status: TraceRecord['status'] = 'ok'): TraceRecord | null {
    if (!this.isEnabled()) return null
    const idKey = traceId ?? this.activeTraceId
    if (!idKey) return null
    const trace = this.traces.get(idKey)
    if (!trace) return null
    const endedAt = new Date().toISOString()
    trace.endedAt = endedAt
    trace.status = status
    trace.totalDurationMs = Math.max(0, Date.parse(endedAt) - Date.parse(trace.startedAt))
    if (this.activeTraceId === idKey) this.activeTraceId = null
    return trace
  }

  /**
   * Record a full lifecycle skeleton for observability demos/tests.
   * Does not invoke Conversation Brain / Journey / Planner engines.
   */
  recordLifecycleSkeleton(options?: {
    conversationId?: string
    latenciesMs?: Partial<Record<TraceDomain, number>>
  }): TraceRecord | null {
    if (!this.isEnabled()) return null
    const trace = this.startTrace({ conversationId: options?.conversationId ?? 'conv_obs_demo' })
    if (!trace) return null
    let parent: string | null = null
    for (const domain of LIFECYCLE_DOMAINS) {
      const span = this.startSpan(`${domain}.step`, domain, {
        parentSpanId: parent,
        attributes: { domain },
        traceId: trace.traceId,
      })
      if (!span) continue
      const latency = options?.latenciesMs?.[domain] ?? 1
      span.startedAt = new Date(Date.now() - latency).toISOString()
      this.endSpan(span.spanId, { status: 'ok' })
      parent = span.spanId
    }
    return this.endTrace(trace.traceId, 'ok')
  }

  getTrace(traceId: string): TraceRecord | undefined {
    return this.traces.get(traceId)
  }

  listTraces(): TraceRecord[] {
    return [...this.traces.values()]
  }

  latencyBreakdown(): Record<TraceDomain, number> {
    const out = {} as Record<TraceDomain, number>
    for (const domain of LIFECYCLE_DOMAINS) out[domain] = 0
    out.system = 0
    for (const trace of this.traces.values()) {
      for (const span of trace.spans) {
        out[span.domain] = (out[span.domain] ?? 0) + (span.durationMs ?? 0)
      }
    }
    return out
  }

  reset(): void {
    this.traces.clear()
    this.activeTraceId = null
  }
}

let shared: Tracer | null = null

export function getTracer(options?: { enabled?: boolean; metrics?: MetricsCollector }): Tracer {
  if (options) return new Tracer(options)
  if (!shared) shared = new Tracer()
  return shared
}

export function resetTracerForTests(): void {
  shared?.reset()
  shared = null
}

export function createTracer(options?: { enabled?: boolean; metrics?: MetricsCollector }): Tracer {
  return new Tracer(options)
}
