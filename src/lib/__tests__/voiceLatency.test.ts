import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createVoiceLatencyMarks, summarizeVoiceLatency } from '../chat/voice/voiceLatency'

describe('voice latency marks', () => {
  beforeEach(() => {
    // no-op
  })
  afterEach(() => {
    // no-op
  })

  it('summarizes STT / first-token / completion / TTS / decode / audio-start', () => {
    const marks = createVoiceLatencyMarks(0)
    marks.sttFinalAt = 200
    marks.requestSentAt = 220
    marks.firstTokenAt = 700
    marks.modelCompleteAt = 1800
    marks.ttsStartedAt = 1810
    marks.ttsResponseAt = 2500
    marks.audioDecodedAt = 2550
    marks.audioStartedAt = 2600
    marks.ttsDoneAt = 3100
    const report = summarizeVoiceLatency(marks)
    expect(report.sttMs).toBe(200)
    expect(report.modelFirstTokenMs).toBe(480)
    expect(report.modelCompletionMs).toBe(1580)
    expect(report.ttsRequestStartMs).toBe(10)
    expect(report.ttsGenerationMs).toBe(690)
    expect(report.audioDecodeMs).toBe(50)
    expect(report.audioStartMs).toBe(2380)
    expect(report.totalSpeakReadyMs).toBe(2600)
    expect(report.userStopToAudioStartMs).toBe(2600)
  })
})
