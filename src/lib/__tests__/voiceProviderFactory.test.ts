import { describe, it, expect } from 'vitest'
import {
  createSpeechToTextProvider,
  createTextToSpeechProvider,
  isBrowserSpeechRecognitionAvailable,
} from '../chat/voice/voiceProviderFactory'
import {
  speechLangFallbacksForLocale,
  speechLangForLocale,
  normalizeVoiceLocale,
} from '../chat/voice/voiceTypes'

describe('voiceProviderFactory', () => {
  it('defaults to mock providers in vitest env', () => {
    expect(createSpeechToTextProvider('mock').providerId).toContain('mock')
    expect(createTextToSpeechProvider('mock').providerId).toContain('mock')
  })

  it('maps locales to Arabic-first speech tags', () => {
    expect(normalizeVoiceLocale('en')).toBe('en')
    expect(normalizeVoiceLocale('fr')).toBe('ar')
    expect(speechLangForLocale('ar')).toBe('ar-SA')
    expect(speechLangForLocale('en')).toBe('en-US')
    expect(speechLangFallbacksForLocale('ar')[0]).toBe('ar-SA')
    expect(speechLangFallbacksForLocale('ar')[1]).toBe('ar')
  })

  it('exposes browser SpeechRecognition availability helper', () => {
    expect(typeof isBrowserSpeechRecognitionAvailable()).toBe('boolean')
  })
})
