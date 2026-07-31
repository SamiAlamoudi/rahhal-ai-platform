import { describe, expect, it } from 'vitest'
import {
  CLASSIC_TTS_MODEL,
  REALTIME_PUBLIC_MODEL,
  VOICE_ARCHITECTURE_EVIDENCE,
  resolvePreferredVoiceArchitecture,
} from '../chat/voice/voiceArchitecture'
import { replyInventedTravelFacts } from '../agent/conversationBrain/greetingGuard'

describe('voice architecture sprint', () => {
  it('defaults to realtime speech-to-speech, not classic TTS', () => {
    expect(resolvePreferredVoiceArchitecture(undefined)).toBe('realtime_speech_to_speech')
    expect(resolvePreferredVoiceArchitecture('realtime')).toBe('realtime_speech_to_speech')
    expect(resolvePreferredVoiceArchitecture('tts')).toBe('classic_tts')
  })

  it('documents that gpt-4o-mini-tts is the classic bottleneck model', () => {
    expect(CLASSIC_TTS_MODEL).toBe('gpt-4o-mini-tts')
    expect(REALTIME_PUBLIC_MODEL).toBe('gpt-realtime-2.1')
    expect(VOICE_ARCHITECTURE_EVIDENCE.ttsBottleneck.length).toBeGreaterThan(0)
    expect(VOICE_ARCHITECTURE_EVIDENCE.chatgptVoiceNotOnApi.join(' ')).toMatch(/GPT-Live|API soon/i)
  })

  it('realtime grounding instructions forbid invented travel facts on greeting style copy', () => {
    const good = 'وعليكم السلام، حياك الله. وين حاب تسافر؟'
    expect(replyInventedTravelFacts(good)).toEqual([])
    const bad = 'مرحبا، رحلة لشخصين بميزانية 10000 دولار إلى إسطنبول'
    expect(replyInventedTravelFacts(bad).length).toBeGreaterThan(0)
  })
})
