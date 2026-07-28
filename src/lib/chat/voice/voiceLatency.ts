/**
 * Voice turn latency markers — measure perceived delay without multi-clip TTS.
 */

export type VoiceLatencyMarks = {
  turnStartedAt: number
  sttFinalAt?: number
  requestSentAt?: number
  firstTokenAt?: number
  modelCompleteAt?: number
  ttsStartedAt?: number
  audioStartedAt?: number
  ttsDoneAt?: number
}

export type VoiceLatencyReport = {
  sttMs: number | null
  modelFirstTokenMs: number | null
  modelCompletionMs: number | null
  ttsGenerationMs: number | null
  audioStartMs: number | null
  totalSpeakReadyMs: number | null
}

export function createVoiceLatencyMarks(now = performanceNow()): VoiceLatencyMarks {
  return { turnStartedAt: now }
}

export function summarizeVoiceLatency(marks: VoiceLatencyMarks): VoiceLatencyReport {
  const base = marks.requestSentAt ?? marks.sttFinalAt ?? marks.turnStartedAt
  const sttMs = marks.sttFinalAt != null && marks.turnStartedAt != null
    ? Math.max(0, marks.sttFinalAt - marks.turnStartedAt)
    : null
  const modelFirstTokenMs = marks.firstTokenAt != null
    ? Math.max(0, marks.firstTokenAt - base)
    : null
  const modelCompletionMs = marks.modelCompleteAt != null
    ? Math.max(0, marks.modelCompleteAt - base)
    : null
  const ttsGenerationMs = marks.ttsStartedAt != null && marks.audioStartedAt != null
    ? Math.max(0, marks.audioStartedAt - marks.ttsStartedAt)
    : (marks.ttsStartedAt != null && marks.ttsDoneAt != null
      ? Math.max(0, marks.ttsDoneAt - marks.ttsStartedAt)
      : null)
  const audioStartMs = marks.audioStartedAt != null
    ? Math.max(0, marks.audioStartedAt - base)
    : null
  const totalSpeakReadyMs = marks.audioStartedAt != null
    ? Math.max(0, marks.audioStartedAt - marks.turnStartedAt)
    : null
  return {
    sttMs,
    modelFirstTokenMs,
    modelCompletionMs,
    ttsGenerationMs,
    audioStartMs,
    totalSpeakReadyMs,
  }
}

function performanceNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}
