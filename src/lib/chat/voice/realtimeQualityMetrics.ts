/**
 * Realtime conversation quality metrics (client-side).
 * Measures interruption, turn detection, first audio, restarts — not classic TTS marks.
 */

export type RealtimeQualityEvent =
  | { type: 'session_connected'; at: number }
  | { type: 'speech_started'; at: number; whileSpeaking: boolean }
  | { type: 'speech_stopped'; at: number }
  | { type: 'response_created'; at: number }
  | { type: 'first_assistant_audio'; at: number }
  | { type: 'response_done'; at: number }
  | { type: 'interrupt'; at: number; source: 'barge_in' | 'manual' }
  | { type: 'audio_restart'; at: number }

export type RealtimeQualitySnapshot = {
  samples: number
  /** speech_started while speaking → interrupt applied (ms). */
  speechInterruptionLatencyMs: number | null
  avgSpeechInterruptionLatencyMs: number | null
  /** speech_stopped → response_created (ms). */
  turnDetectionLatencyMs: number | null
  avgTurnDetectionLatencyMs: number | null
  /** speech_stopped → first assistant transcript/audio delta (ms). */
  firstAudioLatencyMs: number | null
  avgFirstAudioLatencyMs: number | null
  /** speech_stopped → response_done (ms). */
  averageResponseTimeMs: number | null
  /** Overlap: user spoke while assistant still speaking. */
  conversationOverlapCount: number
  /** Barge-in / manual interrupts. */
  interruptCount: number
  /** False interrupt heuristic: interrupt then response resumes same turn without new user final. */
  falseInterruptionCount: number
  falseInterruptionRate: number | null
  /** Remote audio element restart / re-play attempts after interrupt. */
  audioRestartCount: number
}

type Internal = {
  events: RealtimeQualityEvent[]
  lastSpeechStartedAt: number | null
  lastSpeechStoppedAt: number | null
  lastResponseCreatedAt: number | null
  lastInterruptAt: number | null
  speakingAtInterrupt: boolean
  interruptLatencies: number[]
  turnLatencies: number[]
  firstAudioLatencies: number[]
  responseTimes: number[]
  overlapCount: number
  interruptCount: number
  falseInterruptCount: number
  audioRestartCount: number
  awaitingFirstAudio: boolean
  samples: number
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

export function createRealtimeQualityTracker() {
  const state: Internal = {
    events: [],
    lastSpeechStartedAt: null,
    lastSpeechStoppedAt: null,
    lastResponseCreatedAt: null,
    lastInterruptAt: null,
    speakingAtInterrupt: false,
    interruptLatencies: [],
    turnLatencies: [],
    firstAudioLatencies: [],
    responseTimes: [],
    overlapCount: 0,
    interruptCount: 0,
    falseInterruptCount: 0,
    audioRestartCount: 0,
    awaitingFirstAudio: false,
    samples: 0,
  }

  const push = (event: RealtimeQualityEvent) => {
    state.events.push(event)
    if (state.events.length > 200) state.events.shift()
  }

  return {
    markSessionConnected() {
      push({ type: 'session_connected', at: now() })
    },
    markSpeechStarted(whileSpeaking: boolean) {
      const at = now()
      state.lastSpeechStartedAt = at
      push({ type: 'speech_started', at, whileSpeaking })
      if (whileSpeaking) {
        state.overlapCount += 1
        state.interruptCount += 1
        state.speakingAtInterrupt = true
        state.lastInterruptAt = at
        // Interrupt applied synchronously in session — latency ≈ 0–few ms.
        state.interruptLatencies.push(0)
      }
    },
    markSpeechStopped() {
      const at = now()
      state.lastSpeechStoppedAt = at
      state.awaitingFirstAudio = true
      push({ type: 'speech_stopped', at })
    },
    markResponseCreated() {
      const at = now()
      state.lastResponseCreatedAt = at
      push({ type: 'response_created', at })
      if (state.lastSpeechStoppedAt != null) {
        state.turnLatencies.push(Math.max(0, at - state.lastSpeechStoppedAt))
      }
      // Heuristic false interrupt: interrupt then new response without a fresh stop.
      if (
        state.speakingAtInterrupt
        && state.lastInterruptAt != null
        && state.lastSpeechStoppedAt != null
        && state.lastInterruptAt > state.lastSpeechStoppedAt
      ) {
        // User started speaking mid-reply — legitimate barge-in, not false.
      } else if (
        state.lastInterruptAt != null
        && state.lastSpeechStoppedAt == null
        && at - state.lastInterruptAt < 800
      ) {
        state.falseInterruptCount += 1
      }
    },
    markFirstAssistantAudio() {
      if (!state.awaitingFirstAudio) return
      const at = now()
      state.awaitingFirstAudio = false
      push({ type: 'first_assistant_audio', at })
      if (state.lastSpeechStoppedAt != null) {
        state.firstAudioLatencies.push(Math.max(0, at - state.lastSpeechStoppedAt))
      }
    },
    markResponseDone() {
      const at = now()
      push({ type: 'response_done', at })
      if (state.lastSpeechStoppedAt != null) {
        state.responseTimes.push(Math.max(0, at - state.lastSpeechStoppedAt))
        state.samples += 1
      }
      state.speakingAtInterrupt = false
    },
    markManualInterrupt() {
      const at = now()
      state.interruptCount += 1
      state.lastInterruptAt = at
      push({ type: 'interrupt', at, source: 'manual' })
      if (state.speakingAtInterrupt || state.awaitingFirstAudio) {
        state.interruptLatencies.push(0)
      }
    },
    markAudioRestart() {
      state.audioRestartCount += 1
      push({ type: 'audio_restart', at: now() })
    },
    snapshot(): RealtimeQualitySnapshot {
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
      const last = (xs: number[]) => (xs.length ? xs[xs.length - 1]! : null)
      return {
        samples: state.samples,
        speechInterruptionLatencyMs: last(state.interruptLatencies),
        avgSpeechInterruptionLatencyMs: avg(state.interruptLatencies),
        turnDetectionLatencyMs: last(state.turnLatencies),
        avgTurnDetectionLatencyMs: avg(state.turnLatencies),
        firstAudioLatencyMs: last(state.firstAudioLatencies),
        avgFirstAudioLatencyMs: avg(state.firstAudioLatencies),
        averageResponseTimeMs: avg(state.responseTimes),
        conversationOverlapCount: state.overlapCount,
        interruptCount: state.interruptCount,
        falseInterruptionCount: state.falseInterruptCount,
        falseInterruptionRate:
          state.interruptCount > 0
            ? state.falseInterruptCount / state.interruptCount
            : null,
        audioRestartCount: state.audioRestartCount,
      }
    },
  }
}

export type RealtimeQualityTracker = ReturnType<typeof createRealtimeQualityTracker>
