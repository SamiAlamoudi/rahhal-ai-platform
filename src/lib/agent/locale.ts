import type { AgentLocale } from './types'

const ARABIC_CHAR = /[\u0600-\u06FF]/

export function detectAgentLocale(text: string, fallback: AgentLocale = 'ar'): AgentLocale {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  if (ARABIC_CHAR.test(trimmed)) return 'ar'
  if (/[a-zA-Z]/.test(trimmed)) return 'en'
  return fallback
}

export function t(
  locale: AgentLocale,
  table: { ar: string; en: string },
): string {
  return locale === 'en' ? table.en : table.ar
}
