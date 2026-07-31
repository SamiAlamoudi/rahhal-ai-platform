import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getVoiceMeterLevel,
  resetVoiceMeterLevel,
  setVoiceMeterLevel,
  subscribeVoiceMeter,
} from '../chat/voice/voiceMeterStore'

describe('Sprint 80 P1 — voice meter store', () => {
  beforeEach(() => {
    resetVoiceMeterLevel()
  })

  it('clamps and publishes level updates', () => {
    const seen: number[] = []
    const unsub = subscribeVoiceMeter(() => {
      seen.push(getVoiceMeterLevel())
    })
    setVoiceMeterLevel(0.5)
    setVoiceMeterLevel(0.5) // no-op duplicate
    setVoiceMeterLevel(2)
    setVoiceMeterLevel(-1)
    unsub()
    expect(seen).toEqual([0.5, 1, 0])
  })
})

describe('Sprint 80 P1 — TTS unlock does not synthesize warm speech', () => {
  it('unlockAudioPlayback no longer POSTs مرحبا warmup', () => {
    const file = readFileSync(
      resolve(__dirname, '../chat/voice/audioElementTextToSpeechProvider.ts'),
      'utf8',
    )
    expect(file).toContain('preconnectOpenAiTtsRoute')
    expect(file).not.toContain("text: 'مرحبا'")
    expect(file).not.toContain('openai_tts_warmup_ok')
  })
})
