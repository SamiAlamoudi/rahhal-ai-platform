/**
 * Lightweight voice latency instrumentation — never logs transcript content.
 * Aggregates samples for staging p50/p95 summaries.
 */

export type BilamoVoiceMetricMark =
  | 'connect_start'
  | 'connect_ok'
  | 'connect_fail'
  | 'mic_ready'
  | 'listen_start'
  | 'partial_transcript'
  | 'final_transcript'
  | 'response_start'
  | 'speak_start'
  | 'first_audio'
  | 'speak_end'
  | 'interrupt'
  | 'interrupt_ack'
  | 'reconnect_start'
  | 'reconnect_ok'
  | 'reconnect_fail'

export type BilamoVoiceMetricsSnapshot = {
  connectionSetupMs: number | null
  micReadyMs: number | null
  timeToFirstPartialMs: number | null
  timeToFinalTranscriptMs: number | null
  timeToResponseStartMs: number | null
  timeToFirstAudioMs: number | null
  interruptionLatencyMs: number | null
  reconnectLatencyMs: number | null
  transportKind: string | null
  marks: number
}

export type BilamoVoiceLatencyAggregate = {
  count: number
  p50: number | null
  p95: number | null
  last: number | null
}

export type BilamoVoiceMetricsReport = {
  transportKind: string | null
  marks: number
  latest: BilamoVoiceMetricsSnapshot
  aggregates: {
    connectionSetupMs: BilamoVoiceLatencyAggregate
    micReadyMs: BilamoVoiceLatencyAggregate
    timeToFirstPartialMs: BilamoVoiceLatencyAggregate
    timeToFinalTranscriptMs: BilamoVoiceLatencyAggregate
    timeToResponseStartMs: BilamoVoiceLatencyAggregate
    timeToFirstAudioMs: BilamoVoiceLatencyAggregate
    interruptionLatencyMs: BilamoVoiceLatencyAggregate
    reconnectLatencyMs: BilamoVoiceLatencyAggregate
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? null
}

function aggregate(samples: number[]): BilamoVoiceLatencyAggregate {
  if (!samples.length) return { count: 0, p50: null, p95: null, last: null }
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    count: samples.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    last: samples[samples.length - 1] ?? null,
  }
}

export function createBilamoVoiceMetrics() {
  let connectStart: number | null = null
  let listenStart: number | null = null
  let speakStart: number | null = null
  let interruptStart: number | null = null
  let reconnectStart: number | null = null
  let responseAnchor: number | null = null
  let transportKind: string | null = null
  let marks = 0

  const samples = {
    connectionSetupMs: [] as number[],
    micReadyMs: [] as number[],
    timeToFirstPartialMs: [] as number[],
    timeToFinalTranscriptMs: [] as number[],
    timeToResponseStartMs: [] as number[],
    timeToFirstAudioMs: [] as number[],
    interruptionLatencyMs: [] as number[],
    reconnectLatencyMs: [] as number[],
  }

  const snap: BilamoVoiceMetricsSnapshot = {
    connectionSetupMs: null,
    micReadyMs: null,
    timeToFirstPartialMs: null,
    timeToFinalTranscriptMs: null,
    timeToResponseStartMs: null,
    timeToFirstAudioMs: null,
    interruptionLatencyMs: null,
    reconnectLatencyMs: null,
    transportKind: null,
    marks: 0,
  }

  const push = (key: keyof typeof samples, value: number) => {
    samples[key].push(value)
    snap[key] = value
  }

  return {
    setTransportKind(kind: string) {
      transportKind = kind
      snap.transportKind = kind
    },
    mark(event: BilamoVoiceMetricMark) {
      marks += 1
      snap.marks = marks
      const t = now()
      switch (event) {
        case 'connect_start':
          connectStart = t
          break
        case 'connect_ok':
          if (connectStart != null) push('connectionSetupMs', Math.round(t - connectStart))
          break
        case 'listen_start':
          listenStart = t
          snap.timeToFirstPartialMs = null
          snap.timeToFinalTranscriptMs = null
          snap.micReadyMs = null
          break
        case 'mic_ready':
          if (listenStart != null) push('micReadyMs', Math.round(t - listenStart))
          break
        case 'partial_transcript':
          if (listenStart != null && snap.timeToFirstPartialMs == null) {
            push('timeToFirstPartialMs', Math.round(t - listenStart))
          }
          break
        case 'final_transcript':
          if (listenStart != null) {
            push('timeToFinalTranscriptMs', Math.round(t - listenStart))
          }
          responseAnchor = t
          break
        case 'response_start':
          if (responseAnchor != null) {
            push('timeToResponseStartMs', Math.round(t - responseAnchor))
            responseAnchor = null
          }
          break
        case 'speak_start':
          speakStart = t
          snap.timeToFirstAudioMs = null
          break
        case 'first_audio':
          if (speakStart != null && snap.timeToFirstAudioMs == null) {
            push('timeToFirstAudioMs', Math.round(t - speakStart))
          }
          break
        case 'interrupt':
          // Start of user barge-in — measure stop latency via interrupt_ack.
          interruptStart = t
          break
        case 'interrupt_ack':
          if (interruptStart != null) {
            push('interruptionLatencyMs', Math.round(t - interruptStart))
            interruptStart = null
          }
          break
        case 'reconnect_start':
          reconnectStart = t
          break
        case 'reconnect_ok':
          if (reconnectStart != null) {
            push('reconnectLatencyMs', Math.round(t - reconnectStart))
            reconnectStart = null
          }
          break
        default:
          break
      }
    },
    snapshot(): BilamoVoiceMetricsSnapshot {
      return { ...snap, transportKind, marks }
    },
    report(): BilamoVoiceMetricsReport {
      return {
        transportKind,
        marks,
        latest: this.snapshot(),
        aggregates: {
          connectionSetupMs: aggregate(samples.connectionSetupMs),
          micReadyMs: aggregate(samples.micReadyMs),
          timeToFirstPartialMs: aggregate(samples.timeToFirstPartialMs),
          timeToFinalTranscriptMs: aggregate(samples.timeToFinalTranscriptMs),
          timeToResponseStartMs: aggregate(samples.timeToResponseStartMs),
          timeToFirstAudioMs: aggregate(samples.timeToFirstAudioMs),
          interruptionLatencyMs: aggregate(samples.interruptionLatencyMs),
          reconnectLatencyMs: aggregate(samples.reconnectLatencyMs),
        },
      }
    },
    /** Safe summary for logs — no user content. */
    logSafe() {
      return this.report()
    },
  }
}

export type BilamoVoiceMetrics = ReturnType<typeof createBilamoVoiceMetrics>
