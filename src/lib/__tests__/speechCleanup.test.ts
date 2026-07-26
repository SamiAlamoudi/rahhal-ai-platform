import { describe, expect, it } from 'vitest'
import {
  buildLowConfidenceClarification,
  isClearlyEnglish,
  normalizeArabicDigits,
  normalizeCityNames,
  processSpeechTranscript,
  removeDuplicatedWords,
  removeHallucinatedEnglish,
  SPEECH_CONFIDENCE_THRESHOLD,
} from '../chat/voice/speechCleanup'
import {
  DEFAULT_ARABIC_SPEECH_LANG,
  FALLBACK_ARABIC_SPEECH_LANG,
  speechLangFallbacksForLocale,
  speechLangForLocale,
} from '../chat/voice/voiceTypes'
import { resolveInitialSpeechLang } from '../chat/voice/webSpeechToTextProvider'

describe('speechCleanup', () => {
  it('forces Arabic-first recognition tags', () => {
    expect(speechLangForLocale('ar')).toBe('ar-SA')
    expect(speechLangForLocale('ar')).toBe(DEFAULT_ARABIC_SPEECH_LANG)
    expect(speechLangFallbacksForLocale('ar')).toEqual([
      DEFAULT_ARABIC_SPEECH_LANG,
      FALLBACK_ARABIC_SPEECH_LANG,
    ])
    expect(resolveInitialSpeechLang('ar')).toBe('ar-SA')
    expect(resolveInitialSpeechLang('ar')).not.toBe('en-US')
  })

  it('detects clearly English only with strong Latin + cues', () => {
    expect(isClearlyEnglish('أريد رحلة إلى دبي')).toBe(false)
    expect(isClearlyEnglish('hi')).toBe(false)
    expect(isClearlyEnglish('I want a trip to Dubai please')).toBe(true)
  })

  it('removes hallucinated English fragments from Arabic speech', () => {
    const cleaned = removeHallucinatedEnglish('أريد رحلة thank you إلى دبي um')
    expect(cleaned).toContain('أريد')
    expect(cleaned).toContain('دبي')
    expect(cleaned.toLowerCase()).not.toContain('thank')
    expect(cleaned.toLowerCase()).not.toMatch(/\bum\b/)
  })

  it('removes duplicated words and normalizes whitespace', () => {
    expect(removeDuplicatedWords('دبي  دبي   باريس')).toBe('دبي باريس')
  })

  it('normalizes Arabic digits and city names', () => {
    expect(normalizeArabicDigits('من ١٢ إلى ١٥')).toBe('من 12 إلى 15')
    expect(normalizeCityNames('morocco trip to Marrakech')).toContain('المغرب')
    expect(normalizeCityNames('morocco trip to Marrakech')).toContain('مراكش')
  })

  it('pipeline cleans before brain and preserves Arabic intent', () => {
    const result = processSpeechTranscript('أريد رحلة إلى dubai dubai لمدة خمسة أيام', {
      uiLocale: 'ar',
      confidence: 0.9,
    })
    expect(result.needsClarification).toBe(false)
    expect(result.text).toContain('دبي')
    expect(result.text).not.toMatch(/دبي دبي/)
    expect(result.text).toContain('5')
  })

  it('never guesses on low confidence — asks Morocco vs Egypt', () => {
    const result = processSpeechTranscript('أريد السفر', {
      uiLocale: 'ar',
      confidence: SPEECH_CONFIDENCE_THRESHOLD - 0.1,
    })
    expect(result.needsClarification).toBe(true)
    expect(result.text).toBe('')
    expect(result.clarificationPrompt).toBe(
      'لم ألتقط آخر جزء بوضوح، هل تقصد المغرب أم مصر؟',
    )
    expect(buildLowConfidenceClarification('مصر والمغرب')).toContain('مصر')
    expect(buildLowConfidenceClarification('مصر والمغرب')).toContain('المغرب')
  })

  it('does not treat missing/zero confidence as low by itself', () => {
    const result = processSpeechTranscript('أريد رحلة هادئة إلى باريس أسبوعاً كاملاً مع العائلة', {
      uiLocale: 'ar',
      confidence: 0,
    })
    expect(result.needsClarification).toBe(false)
    expect(result.text).toContain('باريس')
  })
})
