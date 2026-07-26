import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  clearVoiceTrace,
  getVoiceTraceRecords,
  isVoiceTracingEnabled,
  voiceStage,
} from '../chat/voice/voiceDebugTrace'

describe('Phase 2.5 voice debug trace', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VOICE_TRACE', 'true')
    clearVoiceTrace()
  })
  afterEach(() => {
    clearVoiceTrace()
    vi.unstubAllEnvs()
  })

  it('is enabled when VITE_VOICE_TRACE=true', () => {
    expect(isVoiceTracingEnabled()).toBe(true)
  })

  it('records chronological stages with state and failure details', () => {
    voiceStage({
      stage: 'MIC_PERMISSION',
      previousState: 'IDLE',
      currentState: 'LISTENING',
    })
    voiceStage({
      stage: 'STT_START',
      previousState: 'LISTENING',
      currentState: 'LISTENING',
    })
    voiceStage({
      stage: 'FINAL_RESULT',
      previousState: 'LISTENING',
      currentState: 'FINAL_TRANSCRIPT',
      transcriptLen: 12,
      preview: 'أريد المغرب',
    })
    voiceStage({
      stage: 'FAILURE',
      success: false,
      previousState: 'SUBMITTING',
      currentState: 'ERROR',
      reason: 'seed_missing',
      recoveryAction: 'retry_voice',
      error: new Error('seed_missing'),
    })

    const rows = getVoiceTraceRecords()
    expect(rows.map((r) => r.stage)).toEqual([
      'MIC_PERMISSION',
      'STT_START',
      'FINAL_RESULT',
      'FAILURE',
    ])
    const fail = rows[3]!
    expect(fail.success).toBe(false)
    expect(fail.reason).toBe('seed_missing')
    expect(fail.recoveryAction).toBe('retry_voice')
    expect(fail.browserCapability).toBeTruthy()
    expect(fail.previousState).toBe('SUBMITTING')
    expect(fail.currentState).toBe('ERROR')
  })
})
