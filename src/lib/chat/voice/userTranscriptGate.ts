/**
 * Gates Realtime input-transcription deltas so travelers never see
 * low-confidence interim text in an unrelated script (e.g. Chinese while speaking Arabic).
 *
 * FINAL transcripts are committed exactly once — never rewritten or substituted with interim.
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

/** Noise / filler / empty ASR that must never spawn an assistant turn. */
const NOISE_ONLY_RE =
  /^(?:um+|uh+|ah+|mm+|hmm+|mhm+|إم+|آه+|اه+|آ+|ه+|هه+|ها+|…+|\.+|-+|~+|\s)+$/iu

/**
 * Confirmed user utterance gate for turn management.
 * Silence, breathing, and accidental sounds must not create a response.
 */
export function isConfirmedUserUtterance(text: string): boolean {
  const t = (text || '').trim()
  if (t.length < 2) return false
  if (NOISE_ONLY_RE.test(t)) return false
  // Require real letters (any script) — not punctuation-only ASR junk.
  const letters = t.replace(/[^\p{L}]/gu, '')
  if (letters.length < 2) return false
  return true
}

/**
 * True when a "user" transcript is likely echo of the assistant's own last reply.
 * Prevents the model from answering itself after response.done.
 */
export function looksLikeAssistantEcho(userText: string, lastAssistantText: string): boolean {
  const user = (userText || '').trim()
  const assistant = (lastAssistantText || '').trim()
  if (!user || !assistant) return false
  if (user.length < 4) return false
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
  const u = normalize(user)
  const a = normalize(assistant)
  if (a.includes(u) && u.length >= 6) return true
  if (u.includes(a) && a.length >= 12) return true
  // High token overlap for short Arabic/English echoes
  const userTokens = new Set(u.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2))
  const asstTokens = a.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2)
  if (userTokens.size === 0 || asstTokens.length === 0) return false
  let hit = 0
  for (const tok of asstTokens) {
    if (userTokens.has(tok)) hit += 1
  }
  const overlap = hit / Math.min(userTokens.size, asstTokens.length)
  return overlap >= 0.7 && hit >= 2
}

/**
 * Per-utterance gate: interim preview only; FINAL commits exact ASR text once.
 * Never rewrites or substitutes the user's recognized words.
 */
export function createUserTranscriptGate(getExpectedLanguage: () => LockedSpeechLanguage | null) {
  let lockedLanguage: LockedSpeechLanguage | null = null
  let interimBuffer = ''
  /** Ephemeral preview only — never promoted to final. */
  let interimPreview: string | null = null
  /** Locked exact FINAL transcript for this user turn (immutable once set). */
  let committedFinal: string | null = null

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
      return
    }
    if (script === 'latin') {
      const expected = getExpectedLanguage()
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
      interimPreview = null
      committedFinal = null
      lockedLanguage = null
    },
    getLockedLanguage(): LockedSpeechLanguage | null {
      return lockedLanguage
    },
    getCommittedFinal(): string | null {
      return committedFinal
    },
    /** Force lock (e.g. from completed transcript after validation). */
    lockLanguage(lang: LockedSpeechLanguage) {
      if (!lockedLanguage) lockedLanguage = lang
    },
    /**
     * Interim preview only (isFinal=false). Never commits.
     * Suppress unsupported-script flash; do not mutate prior committed final.
     */
    ingestDelta(delta: string): TranscriptGateResult {
      if (committedFinal != null) {
        // Final already locked — ignore interim rewrites for this turn.
        return { displayText: null, lockedLanguage, suppressed: true }
      }
      if (!delta) {
        return { displayText: interimPreview, lockedLanguage, suppressed: false }
      }
      interimBuffer += delta
      tryLockFromText(interimBuffer)

      const lang = effectiveLanguage()
      if (isUnsupportedInterimScript(interimBuffer, lang)) {
        return { displayText: interimPreview, lockedLanguage, suppressed: true }
      }

      const trimmed = interimBuffer.trim()
      if (trimmed.length < STABLE_MIN_CHARS) {
        return { displayText: interimPreview, lockedLanguage, suppressed: true }
      }

      interimPreview = trimmed
      return { displayText: trimmed, lockedLanguage, suppressed: false }
    },
    /**
     * Commit exact FINAL ASR once. Never substitute interim text.
     * Returns accepted=false without a displayText commit when rejected.
     */
    ingestFinal(transcript: string): TranscriptGateResult & { accepted: boolean; exactText: string | null } {
      // Already locked — return the exact committed text, ignore further rewrites.
      if (committedFinal != null) {
        return {
          displayText: committedFinal,
          lockedLanguage,
          suppressed: false,
          accepted: true,
          exactText: committedFinal,
        }
      }

      // Exact recognized text — only trim outer whitespace, never rewrite words.
      const exact = (transcript || '').trim()
      if (!exact) {
        return {
          displayText: null,
          lockedLanguage,
          suppressed: true,
          accepted: false,
          exactText: null,
        }
      }

      tryLockFromText(exact)
      const lang = effectiveLanguage()
      if (isUnsupportedInterimScript(exact, lang)) {
        // Reject entirely — do NOT fall back to interim (that rewrites the user).
        return {
          displayText: null,
          lockedLanguage,
          suppressed: true,
          accepted: false,
          exactText: null,
        }
      }

      if (!isConfirmedUserUtterance(exact)) {
        return {
          displayText: null,
          lockedLanguage,
          suppressed: true,
          accepted: false,
          exactText: null,
        }
      }

      committedFinal = exact
      interimPreview = null
      interimBuffer = exact
      if (!lockedLanguage) {
        const script = detectTranscriptScript(exact)
        if (script === 'arabic') lockedLanguage = 'ar'
        else if (script === 'latin') {
          const expected = getExpectedLanguage()
          lockedLanguage = expected && expected !== 'ar' ? expected : 'en'
        }
      }

      return {
        displayText: exact,
        lockedLanguage,
        suppressed: false,
        accepted: true,
        exactText: exact,
      }
    },
  }
}

export type UserTranscriptGate = ReturnType<typeof createUserTranscriptGate>
