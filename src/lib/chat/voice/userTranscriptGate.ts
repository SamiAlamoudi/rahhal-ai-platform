/**
 * Gates Realtime input-transcription deltas so travelers never see
 * low-confidence interim text in an unrelated script (e.g. Chinese while speaking Arabic).
 *
 * Never translates user speech — only filters what is shown and locks the turn language.
 */

import type { ConversationLanguageCode } from './conversationLanguageLayer'

export type LockedSpeechLanguage = Exclude<ConversationLanguageCode, 'auto'>

const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
const CYRILLIC_RE = /[\u0400-\u04FF]/
const LATIN_RE = /[A-Za-z\u00C0-\u024F]/

export type TranscriptScriptKind = 'arabic' | 'latin' | 'cjk' | 'cyrillic' | 'empty' | 'mixed'

export function detectTranscriptScript(text: string): TranscriptScriptKind {
  const t = (text || '').trim()
  if (!t) return 'empty'
  const hasAr = ARABIC_RE.test(t)
  const hasCjk = CJK_RE.test(t)
  const hasCyr = CYRILLIC_RE.test(t)
  const hasLat = LATIN_RE.test(t)
  const kinds = [hasAr, hasCjk, hasCyr, hasLat].filter(Boolean).length
  if (kinds > 1) return 'mixed'
  if (hasAr) return 'arabic'
  if (hasCjk) return 'cjk'
  if (hasCyr) return 'cyrillic'
  if (hasLat) return 'latin'
  return 'empty'
}

/** True when interim text is an unrelated script for the expected / locked language. */
export function isUnsupportedInterimScript(
  text: string,
  expectedOrLocked: LockedSpeechLanguage | null,
): boolean {
  const script = detectTranscriptScript(text)
  if (script === 'empty') return false
  const lang = expectedOrLocked || 'ar'

  // CJK must never leak into non-CJK turns (classic wrong auto-detect).
  if (script === 'cjk' && lang !== 'zh' && lang !== 'ja' && lang !== 'ko') return true

  if (lang === 'ar' || lang === 'ur') {
    // Arabic turn: forbid pure Latin/CJK interim (English/Chinese wrong-detect).
    // Mixed with Arabic may include proper nouns — allow once Arabic is present.
    if (script === 'latin' || script === 'cjk' || script === 'cyrillic') return true
    if (script === 'mixed' && !ARABIC_RE.test(text)) return true
    return false
  }

  if (lang === 'zh' || lang === 'ja' || lang === 'ko') {
    return script === 'arabic' || (script === 'latin' && text.trim().length > 12)
  }

  if (lang === 'ru') {
    return script === 'arabic' || script === 'cjk'
  }

  // Latin-script languages: forbid Arabic/CJK interim.
  return script === 'arabic' || script === 'cjk'
}

/**
 * Map conversation language → OpenAI transcription `language` hint (ISO-639-1).
 * Hinting the model is the root fix for wrong-language interim transcripts.
 */
export function transcriptionLanguageHint(
  language: LockedSpeechLanguage | null | undefined,
): string | undefined {
  if (!language) return 'ar' // Arabic-first product default before first lock
  const map: Record<string, string> = {
    ar: 'ar',
    en: 'en',
    fr: 'fr',
    es: 'es',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt: 'pt',
    ru: 'ru',
    zh: 'zh',
    ja: 'ja',
    ko: 'ko',
    hi: 'hi',
    ur: 'ur',
    id: 'id',
  }
  return map[language] || 'ar'
}

export type TranscriptGateResult = {
  /** Text safe to show; null means show neutral listening only. */
  displayText: string | null
  /** Turn language locked after confident script detection. */
  lockedLanguage: LockedSpeechLanguage | null
  /** True when we suppressed unstable / foreign interim text. */
  suppressed: boolean
}

const LOCK_MIN_CHARS = 4
const STABLE_MIN_CHARS = 2

/**
 * Per-user gate: buffers interim deltas, suppresses foreign scripts,
 * locks language once confident, never changes mid-turn.
 */
export function createUserTranscriptGate(getExpectedLanguage: () => LockedSpeechLanguage | null) {
  let lockedLanguage: LockedSpeechLanguage | null = null
  let interimBuffer = ''
  let lastStableDisplay: string | null = null

  const tryLockFromText = (text: string) => {
    if (lockedLanguage) return
    const script = detectTranscriptScript(text)
    const trimmed = text.replace(/\s+/g, '')
    if (trimmed.length < LOCK_MIN_CHARS) return
    if (script === 'arabic') {
      lockedLanguage = 'ar'
      return
    }
    if (script === 'cjk') {
      // Never lock to CJK from interim alone when product expects Arabic/European —
      // wait for final + explicit detection elsewhere.
      return
    }
    if (script === 'latin') {
      const expected = getExpectedLanguage()
      // Only lock Latin if we already expect a Latin language, or no Arabic expectation.
      if (expected && expected !== 'ar' && expected !== 'ur') {
        lockedLanguage = expected
      }
    }
    if (script === 'cyrillic') {
      lockedLanguage = 'ru'
    }
  }

  const effectiveLanguage = (): LockedSpeechLanguage | null =>
    lockedLanguage || getExpectedLanguage()

  return {
    resetTurn() {
      interimBuffer = ''
      lastStableDisplay = null
      lockedLanguage = null
    },
    getLockedLanguage(): LockedSpeechLanguage | null {
      return lockedLanguage
    },
    /** Force lock (e.g. from completed transcript after validation). */
    lockLanguage(lang: LockedSpeechLanguage) {
      if (!lockedLanguage) lockedLanguage = lang
    },
    ingestDelta(delta: string): TranscriptGateResult {
      if (!delta) {
        return { displayText: lastStableDisplay, lockedLanguage, suppressed: false }
      }
      interimBuffer += delta
      tryLockFromText(interimBuffer)

      const lang = effectiveLanguage()
      if (isUnsupportedInterimScript(interimBuffer, lang)) {
        return { displayText: lastStableDisplay, lockedLanguage, suppressed: true }
      }

      const trimmed = interimBuffer.trim()
      if (trimmed.length < STABLE_MIN_CHARS) {
        return { displayText: lastStableDisplay, lockedLanguage, suppressed: true }
      }

      lastStableDisplay = trimmed
      return { displayText: trimmed, lockedLanguage, suppressed: false }
    },
    ingestFinal(transcript: string): TranscriptGateResult & { accepted: boolean } {
      const text = (transcript || '').trim()
      interimBuffer = text
      tryLockFromText(text)

      const lang = effectiveLanguage()
      if (text && isUnsupportedInterimScript(text, lang)) {
        // Reject foreign-script "final" that contradicts the locked/expected language.
        return {
          displayText: lastStableDisplay,
          lockedLanguage,
          suppressed: true,
          accepted: false,
        }
      }

      if (text) {
        lastStableDisplay = text
        // Lock from final Arabic/Latin once accepted.
        if (!lockedLanguage) {
          const script = detectTranscriptScript(text)
          if (script === 'arabic') lockedLanguage = 'ar'
          else if (script === 'latin') {
            const expected = getExpectedLanguage()
            lockedLanguage = expected && expected !== 'ar' ? expected : 'en'
          }
        }
      }

      return {
        displayText: text || lastStableDisplay,
        lockedLanguage,
        suppressed: false,
        accepted: Boolean(text),
      }
    },
  }
}

export type UserTranscriptGate = ReturnType<typeof createUserTranscriptGate>
