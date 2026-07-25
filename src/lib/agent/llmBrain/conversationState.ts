/**
 * Phase 5 — ConversationState
 * Tracks turn-level consultant state (dialect, locale, corrections).
 */

import type { LiveTravelMemory } from '../conversationIntelligence'
import { createEmptyLiveTravelMemory } from '../conversationIntelligence'
import type { ArabicDialect, ConversationStateSnapshot, LlmBrainLocale } from './types'

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n))
}

export function detectArabicDialect(text: string): ArabicDialect {
  const t = text.trim()
  if (!t) return 'unknown'
  const hasArabic = /[\u0600-\u06FF]/.test(t)
  const hasLatin = /[a-zA-Z]/.test(t)
  if (hasArabic && hasLatin) return 'mixed'

  // Order matters: more specific dialects before broad Saudi/MSA.
  if (hasAny(t, ['بغيت', 'واش', 'بزاف', 'فين غادي', 'صحا', 'كاين'])) return 'moroccan'
  if (hasAny(t, ['عايز', 'عاوز', 'كده', 'فين', 'دلوقتي', 'معلش', 'ازيك', 'إزيّك'])) return 'egyptian'
  if (hasAny(t, ['بدي', 'شو', 'هلق', 'هلأ', 'منيح', 'كمان'])) return 'levant'
  if (hasAny(t, ['اشتي', 'أشتي', 'داير', 'ديار'])) return 'yemeni'
  if (hasAny(t, ['شحال', 'شلون', 'يبي', 'يبيه', 'حط لي'])) return 'gulf'
  if (hasAny(t, ['أبي', 'ابغى', 'أبغى', 'ودي', 'خلها', 'خلّها', 'مو مشكلة', 'وش'])) return 'saudi'

  if (hasArabic) return 'msa'
  return 'unknown'
}

export function detectLocale(text: string, preferred?: LlmBrainLocale): LlmBrainLocale {
  if (preferred) return preferred
  return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en'
}

export function createConversationState(input: {
  userText: string
  memory?: LiveTravelMemory | null
  locale?: LlmBrainLocale
  turn?: number
  openQuestions?: string[]
  corrections?: string[]
}): ConversationStateSnapshot {
  const locale = detectLocale(input.userText, input.locale)
  return {
    turn: input.turn ?? 1,
    dialect: detectArabicDialect(input.userText),
    locale,
    memory: input.memory ?? createEmptyLiveTravelMemory(),
    lastUserText: input.userText.trim(),
    compressedFacts: [],
    openQuestions: input.openQuestions ?? [],
    corrections: input.corrections ?? [],
  }
}

/** Detect simple corrections / interruptions. */
export function extractCorrections(userText: string): string[] {
  const t = userText.trim()
  const out: string[] = []
  if (
    /actually|instead|\bnot\b|change|عدل|بدل|مو كذا|لا أقصد|خلها|خلّها/i.test(t)
  ) {
    out.push(t.slice(0, 160))
  }
  return out
}

export const ConversationState = {
  create: createConversationState,
  detectArabicDialect,
  detectLocale,
  extractCorrections,
}
