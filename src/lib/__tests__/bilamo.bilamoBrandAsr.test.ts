import { describe, expect, it } from 'vitest'
import { normalizeBilamoAssistantName } from '../chat/voice/bilamoBrandAsr'
import { sanitizeArabicVoiceTranscript } from '../chat/voice/sanitizeArabicVoiceTranscript'

describe('Bilamo brand ASR normalization', () => {
  it('maps greeting مرحبا بيلامو / بلال → بيلامو', () => {
    expect(normalizeBilamoAssistantName('مرحبا بيلامو').normalized).toBe('مرحبا بيلامو')
    expect(normalizeBilamoAssistantName('مرحبا بلال').normalized).toBe('مرحبا بيلامو')
    expect(normalizeBilamoAssistantName('مرحبا بلال').assistantNameMatch).toBe(true)
    expect(sanitizeArabicVoiceTranscript('مرحبا بلال')).toBe('مرحبا بيلامو')
  })

  it('maps هلا بيلامو / بلال → بيلامو', () => {
    expect(normalizeBilamoAssistantName('هلا بيلامو').normalized).toBe('هلا بيلامو')
    expect(normalizeBilamoAssistantName('هلا بلال').normalized).toBe('هلا بيلامو')
  })

  it('maps vocative travel request بلال أبغى أسافر → بيلامو', () => {
    expect(normalizeBilamoAssistantName('بلال أبغى أسافر').normalized).toBe('بيلامو أبغى أسافر')
    expect(normalizeBilamoAssistantName('بيلامو أبغى أسافر').normalized).toBe('بيلامو أبغى أسافر')
  })

  it('preserves person name اسمي بلال', () => {
    const r = normalizeBilamoAssistantName('اسمي بلال')
    expect(r.normalized).toBe('اسمي بلال')
    expect(r.preservedPersonBilal).toBe(true)
    expect(sanitizeArabicVoiceTranscript('اسمي بلال')).toBe('اسمي بلال')
  })

  it('preserves أنا مع بلال and بلال بيسافر معي', () => {
    expect(normalizeBilamoAssistantName('أنا مع بلال').normalized).toBe('أنا مع بلال')
    expect(normalizeBilamoAssistantName('بلال بيسافر معي').normalized).toBe('بلال بيسافر معي')
  })

  it('canonicalizes بلا مو / بلامو brand variants', () => {
    expect(normalizeBilamoAssistantName('مرحبا بلا مو').normalized).toBe('مرحبا بيلامو')
    expect(normalizeBilamoAssistantName('هلا بلامو').normalized).toBe('هلا بيلامو')
  })
})
