/**
 * Bilamo reply language bridge.
 * AgentLocale stays ar|en for legacy agent spine; replyLanguage carries the
 * actual spoken/written language for ASR + consultant copy.
 */

import type { AgentLocale } from '../../agent/types'
import type { ConversationLanguageCode } from '../../chat/voice/conversationLanguageLayer'
import type { VoiceLocale } from '../../chat/voice/voiceTypes'

/** User-facing reply languages Bilamo understands end-to-end. */
export type BilamoReplyLocale = Exclude<ConversationLanguageCode, 'auto'>

const REPLY_LOCALES: readonly BilamoReplyLocale[] = [
  'ar',
  'en',
  'fr',
  'es',
  'de',
  'it',
  'tr',
  'pt',
  'ru',
  'zh',
  'ja',
  'ko',
  'hi',
  'ur',
  'id',
] as const

export function isBilamoReplyLocale(value: string | null | undefined): value is BilamoReplyLocale {
  return Boolean(value && (REPLY_LOCALES as readonly string[]).includes(value))
}

/**
 * Coerce detector output into a reply locale.
 * Never collapse Latin languages to Arabic — that locked ASR to `ar` and
 * rejected French/Spanish/etc. finals.
 */
export function coerceReplyLocale(
  value: string | null | undefined,
  fallback: BilamoReplyLocale = 'ar',
): BilamoReplyLocale {
  if (isBilamoReplyLocale(value)) return value
  // Unknown codes: Latin-script travelers fall back to English, not Arabic.
  if (fallback === 'ar' && value && /^[a-z]{2}$/i.test(value) && value.toLowerCase() !== 'ar') {
    return 'en'
  }
  return fallback
}

/** Map reply language onto AgentLocale (non-Arabic → en for legacy agent fields). */
export function replyLocaleToAgentLocale(locale: BilamoReplyLocale): AgentLocale {
  return locale === 'ar' ? 'ar' : 'en'
}

/**
 * Voice transport locale for ASR + speak.
 * Prefer exact language; unknown → en (never ar for Latin).
 */
export function replyLocaleToVoiceLocale(locale: BilamoReplyLocale): VoiceLocale {
  return locale as VoiceLocale
}

export function coerceAgentLocale(
  value: string | null | undefined,
  fallback: AgentLocale = 'ar',
): AgentLocale {
  if (value === 'en' || value === 'ar') return value
  if (isBilamoReplyLocale(value) && value !== 'ar') return 'en'
  return fallback
}

/** Short confirm prompt — repeat ONLY the uncertain word/phrase. */
export function composeUncertainWordConfirm(
  word: string,
  locale: BilamoReplyLocale,
): { displayText: string; spokenText: string } {
  const token = word.trim()
  if (locale === 'ar') {
    const line = `هل تقصد ${token}؟`
    return { displayText: line, spokenText: line }
  }
  if (locale === 'fr') {
    const line = `${token} — c'est bien ça ?`
    return { displayText: line, spokenText: line }
  }
  if (locale === 'es') {
    const line = `¿${token}?`
    return { displayText: line, spokenText: line }
  }
  if (locale === 'de') {
    const line = `${token} — richtig?`
    return { displayText: line, spokenText: line }
  }
  if (locale === 'it') {
    const line = `${token} — corretto?`
    return { displayText: line, spokenText: line }
  }
  if (locale === 'tr') {
    const line = `${token} — doğru mu?`
    return { displayText: line, spokenText: line }
  }
  const line = `${token}?`
  return { displayText: line, spokenText: line }
}
