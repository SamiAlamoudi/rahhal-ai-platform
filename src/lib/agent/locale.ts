import type { AgentLocale } from './types'
import { detectConversationLanguage } from '../chat/voice/conversationLanguageLayer'
import {
  coerceReplyLocale,
  replyLocaleToAgentLocale,
  type BilamoReplyLocale,
} from '../bilamo/speech/localeBridge'

const ARABIC_CHAR = /[\u0600-\u06FF]/

export function detectAgentLocale(text: string, fallback: AgentLocale = 'ar'): AgentLocale {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  if (ARABIC_CHAR.test(trimmed)) return 'ar'
  const detected = detectConversationLanguage(trimmed)
  if (detected.language === 'fr' && detected.confidence >= 0.35) {
    // French is a first-class Bilamo reply language; AgentLocale maps to en.
    return 'en'
  }
  if (/[a-zA-Z]/.test(trimmed)) return 'en'
  return fallback
}

/** Detect Bilamo reply language including French. */
export function detectReplyLocale(
  text: string,
  fallback: BilamoReplyLocale = 'ar',
): BilamoReplyLocale {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  if (ARABIC_CHAR.test(trimmed)) return 'ar'
  const detected = detectConversationLanguage(trimmed)
  if (detected.language === 'fr' && detected.confidence >= 0.35) return 'fr'
  if (detected.language === 'en' || /[a-zA-Z]/.test(trimmed)) return 'en'
  return coerceReplyLocale(fallback, 'ar')
}

export function t(
  locale: AgentLocale | BilamoReplyLocale,
  table: { ar: string; en: string; fr?: string },
): string {
  if (locale === 'fr') return table.fr ?? table.en
  if (locale === 'en') return table.en
  return table.ar
}

export function agentLocaleFromReply(locale: BilamoReplyLocale): AgentLocale {
  return replyLocaleToAgentLocale(locale)
}
