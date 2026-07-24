/**
 * Phase 3 Stage 1 — Conversation context (append-only).
 * Never overwrites prior user facts; corrections via mergeKnownFacts win.
 */

import { mergeKnownFacts } from './conversationMemory'
import type {
  ConversationIntent,
  ConversationKnownFacts,
  ConversationLocale,
  ConversationState,
} from './types'
import { clamp01 } from './types'
import { createEmptyConversationState } from './conversationState'

export interface ConversationContextBag {
  locale: ConversationLocale
  conversationId: string
  userText: string
  knownFacts: ConversationKnownFacts
  state: ConversationState
}

export function buildConversationContext(input: {
  conversationId: string
  userText: string
  locale?: ConversationLocale
  known?: ConversationKnownFacts
  state?: ConversationState | null
}): ConversationContextBag {
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const base =
    input.state
      ? input.state
      : createEmptyConversationState(input.conversationId, locale)

  const knownFacts = mergeKnownFacts(base.knownFacts, input.known)
  return {
    locale,
    conversationId: input.conversationId,
    userText: input.userText,
    knownFacts,
    state: {
      ...base,
      locale,
      conversationId: input.conversationId,
      knownFacts,
    },
  }
}

const DEST_HINTS: Array<{ re: RegExp; name: string }> = [
  { re: /japan|اليابان/i, name: 'Japan' },
  { re: /istanbul|إسطنبول|اسطنبول/i, name: 'Istanbul' },
  { re: /dubai|دبي/i, name: 'Dubai' },
  { re: /maldives|المالديف/i, name: 'Maldives' },
  { re: /london|لندن/i, name: 'London' },
  { re: /paris|باريس/i, name: 'Paris' },
  { re: /bali|بالي/i, name: 'Bali' },
  { re: /italy|إيطاليا|ايطاليا/i, name: 'Italy' },
  { re: /spain|إسبانيا|اسبانيا/i, name: 'Spain' },
  { re: /turkey|تركيا/i, name: 'Turkey' },
  { re: /morocco|المغرب/i, name: 'Morocco' },
  { re: /thailand|تايلند|تايلاند/i, name: 'Thailand' },
  { re: /korea|كوريا/i, name: 'Korea' },
]

/**
 * Conservative fact extraction from traveler wording.
 * Never invents amounts/destinations without a textual cue.
 */
export function extractKnownFactsFromText(text: string): ConversationKnownFacts {
  const facts: ConversationKnownFacts = {}
  const t = text.trim()
  if (!t) return facts

  for (const row of DEST_HINTS) {
    if (row.re.test(t)) {
      facts.destination = row.name
      break
    }
  }

  const budgetMatch =
    t.match(/(\d{3,7})\s*(sar|usd|eur|ريال|ر\.?\s*س)/i)
    ?? t.match(/(?:budget|ميزانية)\D{0,12}(\d{3,7})/i)
  if (budgetMatch) {
    const amount = Number(budgetMatch[1])
    if (Number.isFinite(amount) && amount > 0) {
      facts.budgetAmount = amount
      const cur = (budgetMatch[2] || '').toLowerCase()
      if (/usd|dollar/.test(cur)) facts.budgetCurrency = 'USD'
      else if (/eur|euro/.test(cur)) facts.budgetCurrency = 'EUR'
      else facts.budgetCurrency = 'SAR'
    }
  }

  const daysMatch =
    t.match(/(\d{1,2})\s*(?:days?|day|ليال[يى]|ليلة|أيام|يوم)/i)
    ?? t.match(/(?:for|لمدة)\s+(\d{1,2})/i)
  if (daysMatch) {
    const days = Number(daysMatch[1])
    if (Number.isFinite(days) && days > 0 && days <= 60) {
      facts.durationDays = days
    }
  }

  const adultsMatch = t.match(/(\d)\s*(?:adults?|بالغ|بالغين)/i)
  if (adultsMatch) {
    const n = Number(adultsMatch[1])
    if (Number.isFinite(n) && n > 0 && n <= 12) facts.adults = n
  }

  if (/\b(honeymoon|romantic)\b|شهر عسل|رومانسي/i.test(t)) {
    facts.tripPurpose = 'honeymoon'
  } else if (/\b(family|kids?|children)\b|عائل|أطفال/i.test(t)) {
    facts.tripPurpose = 'family'
  } else if (/\b(business|work)\b|عمل|رجال أعمال/i.test(t)) {
    facts.tripPurpose = 'business'
  }

  const interests: string[] = []
  if (/\b(food|culinary|restaurants?)\b|طعام|مطاعم/i.test(t)) interests.push('food')
  if (/\b(beach|sea|island)\b|شاطئ|بحر|جزيرة/i.test(t)) interests.push('beach')
  if (/\b(culture|museum|history)\b|ثقافة|متحف|تاريخ/i.test(t)) interests.push('culture')
  if (/\b(adventure|hiking|nature)\b|مغامرة|طبيعة|هايكنج/i.test(t)) interests.push('adventure')
  if (interests.length) facts.interests = interests

  return facts
}

export function computeMissingInformation(
  known: ConversationKnownFacts,
  intent: ConversationIntent,
): string[] {
  const missing: string[] = []
  const needsDestination =
    intent === 'destination_discovery'
    || intent === 'trip_planning'
    || intent === 'recommendation'
    || intent === 'compare_destinations'
    || intent === 'itinerary_refinement'
    || intent === 'budget_optimization'

  if (needsDestination && !known.destination) missing.push('destination')
  if (
    (intent === 'trip_planning' || intent === 'budget_optimization')
    && known.budgetAmount == null
  ) {
    missing.push('budget')
  }
  if (
    (intent === 'trip_planning' || intent === 'itinerary_refinement')
    && known.durationDays == null
  ) {
    missing.push('duration')
  }
  if (intent === 'compare_destinations' && !known.compareWith && !known.destination) {
    missing.push('compare_targets')
  }
  return missing
}

export function scoreConversationConfidence(input: {
  knownFacts: ConversationKnownFacts
  missingInformation: string[]
  intent: ConversationIntent
}): number {
  const { knownFacts, missingInformation, intent } = input
  let score = 0.35

  if (knownFacts.destination) score += 0.25
  if (knownFacts.budgetAmount != null) score += 0.15
  if (knownFacts.durationDays != null) score += 0.1
  if (knownFacts.tripPurpose) score += 0.05
  if ((knownFacts.interests?.length ?? 0) > 0) score += 0.05

  score -= missingInformation.length * 0.12

  if (intent === 'general_travel_advice' && knownFacts.destination) score += 0.1
  if (intent === 'clarification_reply') score += 0.08
  if (intent === 'continue_previous' && knownFacts.destination) score += 0.1

  return clamp01(score)
}

export const ConversationContext = {
  build: buildConversationContext,
  mergeFacts: mergeKnownFacts,
  extractFacts: extractKnownFactsFromText,
  missing: computeMissingInformation,
  scoreConfidence: scoreConversationConfidence,
}
