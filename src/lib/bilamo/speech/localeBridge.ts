/**
 * Bilamo reply language — AR/EN/FR for consultant copy + speak path.
 * AgentLocale stays ar|en for legacy agent spine; French maps to AgentLocale 'en'
 * while replyLanguage carries the actual spoken/written language.
 */

import type { AgentLocale } from '../../agent/types'
import type { VoiceLocale } from '../../chat/voice/voiceTypes'

/** User-facing reply language for Bilamo consultant turns. */
export type BilamoReplyLocale = 'ar' | 'en' | 'fr'

export function coerceReplyLocale(
  value: string | null | undefined,
  fallback: BilamoReplyLocale = 'ar',
): BilamoReplyLocale {
  if (value === 'en' || value === 'fr' || value === 'ar') return value
  return fallback
}

/** Map reply language onto AgentLocale (French → en for legacy agent fields). */
export function replyLocaleToAgentLocale(locale: BilamoReplyLocale): AgentLocale {
  return locale === 'ar' ? 'ar' : 'en'
}

/** TTS transport locale — French uses Latin/en TTS voices (OpenAI nova handles FR). */
export function replyLocaleToVoiceLocale(locale: BilamoReplyLocale): VoiceLocale {
  return locale === 'ar' ? 'ar' : 'en'
}

export function coerceAgentLocale(
  value: string | null | undefined,
  fallback: AgentLocale = 'ar',
): AgentLocale {
  if (value === 'en' || value === 'ar') return value
  if (value === 'fr') return 'en'
  return fallback
}
