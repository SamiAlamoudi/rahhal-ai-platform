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

  it('maps locales to speech tags', () => {
    expect(normalizeVoiceLocale('en')).toBe('en')
    expect(normalizeVoiceLocale('fr')).toBe('ar')
    expect(speechLangForLocale('ar')).toBe('ar-SA')
    expect(speechLangForLocale('en')).toBe('en-US')
  })
})
