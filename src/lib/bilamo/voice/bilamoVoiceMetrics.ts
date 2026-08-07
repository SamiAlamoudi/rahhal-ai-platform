/**
 * Lightweight voice latency instrumentation — never logs transcript content.
 */

export type BilamoVoiceMetricMark =
  | 'connect_start'
  | 'connect_ok'
  | 'connect_fail'
  | 'listen_start'
  | 'partial_transcript'
  | 'final_transcript'
  | 'speak_start'
  | 'first_audio'
  | 'speak_end'
  | 'interrupt'
  | 'reconnect_start'
  | 'reconnect_ok'
  | 'reconnect_fail'

export type BilamoVoiceMetricsSnapshot = {
  connectionSetupMs: number | null
  timeToFirstPartialMs: number | null
  timeToFinalTranscriptMs: number | null
  timeToFirstAudioMs: number | null
  interruptionLatencyMs: number | null
  reconnectLatencyMs: number | null
  transportKind: string | null
  marks: number
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function createBilamoVoiceMetrics() {
  let connectStart: number | null = null
  let listenStart: number | null = null
  let speakStart: number | null = null
  let interruptStart: number | null = null
  let reconnectStart: number | null = null
  let transportKind: string | null = null
  let marks = 0

  const snap: BilamoVoiceMetricsSnapshot = {
    connectionSetupMs: null,
    timeToFirstPartialMs: null,
    timeToFinalTranscriptMs: null,
    timeToFirstAudioMs: null,
    interruptionLatencyMs: null,
    reconnectLatencyMs: null,
    transportKind: null,
    marks: 0,
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
          if (connectStart != null) snap.connectionSetupMs = Math.round(t - connectStart)
          break
        case 'listen_start':
          listenStart = t
          break
        case 'partial_transcript':
          if (listenStart != null && snap.timeToFirstPartialMs == null) {
            snap.timeToFirstPartialMs = Math.round(t - listenStart)
          }
          break
        case 'final_transcript':
          if (listenStart != null) {
            snap.timeToFinalTranscriptMs = Math.round(t - listenStart)
          }
          break
        case 'speak_start':
          speakStart = t
          break
        case 'first_audio':
          if (speakStart != null && snap.timeToFirstAudioMs == null) {
            snap.timeToFirstAudioMs = Math.round(t - speakStart)
          }
          break
        case 'interrupt':
          interruptStart = t
          if (speakStart != null) {
            snap.interruptionLatencyMs = Math.round(t - speakStart)
          }
          break
        case 'reconnect_start':
          reconnectStart = t
          break
        case 'reconnect_ok':
          if (reconnectStart != null) {
            snap.reconnectLatencyMs = Math.round(t - reconnectStart)
          }
          break
        default:
          break
      }
    },
    snapshot(): BilamoVoiceMetricsSnapshot {
      return { ...snap, transportKind, marks }
    },
    /** Safe summary for logs — no user content. */
    logSafe() {
      return {
        ...this.snapshot(),
        interruptedAt: interruptStart,
      }
    },
  }
}

export type BilamoVoiceMetrics = ReturnType<typeof createBilamoVoiceMetrics>
