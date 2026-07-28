import { describe, expect, it } from 'vitest'
import { createVoiceLatencyMarks, summarizeVoiceLatency } from '../chat/voice/voiceLatency'

describe('voice latency marks', () => {
  it('summarizes STT / first-token / completion / TTS / audio-start', () => {
    const marks = createVoiceLatencyMarks(0)
    marks.sttFinalAt = 200
    marks.requestSentAt = 220
    marks.firstTokenAt = 700
    marks.modelCompleteAt = 1800
    marks.ttsStartedAt = 1810
    marks.audioStartedAt = 2300
    marks.ttsDoneAt = 3100
    const report = summarizeVoiceLatency(marks)
    expect(report.sttMs).toBe(200)
    expect(report.modelFirstTokenMs).toBe(480)
    expect(report.modelCompletionMs).toBe(1580)
    expect(report.ttsGenerationMs).toBe(490)
    expect(report.audioStartMs).toBe(2080)
    expect(report.totalSpeakReadyMs).toBe(2300)
  })
})
