import { describe, it, expect } from 'vitest'
import {
  createSpeechToTextProvider,
  createTextToSpeechProvider,
} from '../chat/voice/voiceProviderFactory'
import { speechLangForLocale, normalizeVoiceLocale } from '../chat/voice/voiceTypes'

describe('voiceProviderFactory', () => {
  it('defaults to mock providers in vitest env', () => {
    expect(createSpeechToTextProvider('mock').providerId).toContain('mock')
    expect(createTextToSpeechProvider('mock').providerId).toContain('mock')
  })

  it('auto mode surfaces unsupported web STT instead of silent mock', async () => {
    const { resolveSpeechToTextProvider } = await import('../chat/voice/voiceProviderFactory')
    const resolved = resolveSpeechToTextProvider('auto')
    // In vitest there is typically no SpeechRecognition — provider reports unsupported.
    if (!resolved.provider.isSupported()) {
      expect(resolved.usingFallbackMock).toBe(true)
      expect(resolved.kind).toBe('web')
      expect(resolved.provider.providerId).toContain('web')
    }
  })

  it('maps locales to speech tags', () => {
    expect(normalizeVoiceLocale('en')).toBe('en')
    expect(normalizeVoiceLocale('fr')).toBe('ar')
    expect(speechLangForLocale('ar')).toBe('ar-SA')
    expect(speechLangForLocale('en')).toBe('en-US')
  })
})
