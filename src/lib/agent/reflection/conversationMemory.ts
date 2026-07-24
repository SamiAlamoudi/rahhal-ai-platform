/**
 * Evolution Sprint 2 — ConversationMemory
 * Append-only turn log + light slot extraction from traveler text.
 * Deterministic — no LLM / network.
 */

import type { ConsultantLocale } from '../reasoning/consultantTypes'
import {
  newId,
  type ConversationTurn,
  type KnownSlots,
  type ReflectionSession,
} from './reflectionTypes'

const MONTH_HINTS: Array<{ re: RegExp; month: number }> = [
  { re: /\bjan(uary)?\b|يناير/i, month: 1 },
  { re: /\bfeb(ruary)?\b|فبراير/i, month: 2 },
  { re: /\bmar(ch)?\b|مارس/i, month: 3 },
  { re: /\bapr(il)?\b|أبريل|ابريل/i, month: 4 },
  { re: /\bmay\b|مايو/i, month: 5 },
  { re: /\bjun(e)?\b|يونيو/i, month: 6 },
  { re: /\bjul(y)?\b|يوليو/i, month: 7 },
  { re: /\baug(ust)?\b|أغسطس|اغسطس/i, month: 8 },
  { re: /\bsep(t(ember)?)?\b|سبتمبر/i, month: 9 },
  { re: /\boct(ober)?\b|أكتوبر|اكتوبر/i, month: 10 },
  { re: /\bnov(ember)?\b|نوفمبر/i, month: 11 },
  { re: /\bdec(ember)?\b|ديسمبر/i, month: 12 },
]

const DEST_HINTS: Array<{ re: RegExp; name: string }> = [
  { re: /istanbul|إسطنبول|اسطنبول/i, name: 'Istanbul' },
  { re: /dubai|دبي/i, name: 'Dubai' },
  { re: /baku|باكو/i, name: 'Baku' },
  { re: /maldives|المالديف/i, name: 'Maldives' },
  { re: /cairo|القاهرة/i, name: 'Cairo' },
  { re: /london|لندن/i, name: 'London' },
  { re: /paris|باريس/i, name: 'Paris' },
  { re: /bali|بالي/i, name: 'Bali' },
  { re: /georgia|جورجيا/i, name: 'Georgia' },
  { re: /riyadh|الرياض/i, name: 'Riyadh' },
]

/**
 * Extract a conservative slot delta from traveler wording.
 * Never invents amounts/destinations without a textual cue.
 */
export function extractSlotDeltaFromText(text: string): {
  delta: Partial<KnownSlots>
  evidence: string[]
} {
  const delta: Partial<KnownSlots> = {}
  const evidence: string[] = []
  const t = text.trim()
  if (!t) return { delta, evidence }

  for (const row of DEST_HINTS) {
    if (row.re.test(t)) {
      delta.destination = row.name
      evidence.push(`destination:${row.name}`)
      break
    }
  }

  const budgetMatch =
    t.match(/(\d{3,6})\s*(sar|usd|eur|ريال|ر\.?\s*س)/i)
    ?? t.match(/(?:budget|ميزانية)\D{0,12}(\d{3,6})/i)
  if (budgetMatch) {
    const amount = Number(budgetMatch[1])
    if (Number.isFinite(amount) && amount > 0) {
      delta.budgetAmount = amount
      evidence.push(`budgetAmount:${amount}`)
      const cur = (budgetMatch[2] || '').toLowerCase()
      if (/usd|dollar/.test(cur)) delta.budgetCurrency = 'USD'
      else if (/eur|euro/.test(cur)) delta.budgetCurrency = 'EUR'
      else delta.budgetCurrency = 'SAR'
      if (delta.budgetCurrency) evidence.push(`budgetCurrency:${delta.budgetCurrency}`)
    }
  }

  const daysMatch =
    t.match(/(\d{1,2})\s*(?:days?|ليالي|ليلة|أيام|يوم)/i)
    ?? t.match(/(?:for|لمدة)\s*(\d{1,2})/i)
  if (daysMatch) {
    const days = Number(daysMatch[1])
    if (Number.isFinite(days) && days > 0 && days <= 60) {
      delta.durationDays = days
      evidence.push(`durationDays:${days}`)
    }
  }

  const adultsMatch = t.match(/(\d)\s*(?:adults?|بالغ|بالغين)/i)
  if (adultsMatch) {
    delta.adults = Number(adultsMatch[1])
    evidence.push(`adults:${delta.adults}`)
  }
  const childrenMatch = t.match(/(\d)\s*(?:children|kids|أطفال|طفل)/i)
  if (childrenMatch) {
    delta.children = Number(childrenMatch[1])
    evidence.push(`children:${delta.children}`)
  } else if (/\bfamily\b|عائلة|أطفال/i.test(t) && delta.children == null) {
    // Soft signal only via tripPurpose / interests — do not invent child count.
  }

  if (/honeymoon|شهر\s*عسل/i.test(t)) {
    delta.tripPurpose = 'honeymoon'
    evidence.push('tripPurpose:honeymoon')
  } else if (/\bfamily\b|عائلة|أطفال/i.test(t)) {
    delta.tripPurpose = 'family'
    evidence.push('tripPurpose:family')
  } else if (/\bbusiness\b|عمل|مؤتمر/i.test(t)) {
    delta.tripPurpose = 'business'
    evidence.push('tripPurpose:business')
  } else if (/adventure|مغامرة/i.test(t)) {
    delta.tripPurpose = 'adventure'
    evidence.push('tripPurpose:adventure')
  }

  const interests: string[] = []
  if (/beach|بحر|شاطئ/i.test(t)) interests.push('beach')
  if (/food|مطعم|cuisine/i.test(t)) interests.push('food')
  if (/nature|طبيعة|hike/i.test(t)) interests.push('nature')
  if (/culture|ثقافة|museum|متحف/i.test(t)) interests.push('culture')
  if (interests.length) {
    delta.interests = interests
    evidence.push(`interests:${interests.join(',')}`)
  }

  for (const row of MONTH_HINTS) {
    if (row.re.test(t)) {
      delta.monthHint = row.month
      evidence.push(`monthHint:${row.month}`)
      break
    }
  }

  return { delta, evidence }
}

export function appendUserTurn(
  session: ReflectionSession,
  text: string,
  locale: ConsultantLocale,
  knownDelta: Partial<KnownSlots> | undefined,
  now?: Date,
): ConversationTurn {
  const extracted = extractSlotDeltaFromText(text)
  const slotDelta: Partial<KnownSlots> = {
    ...extracted.delta,
    ...(knownDelta ?? {}),
  }
  const evidence = [
    ...extracted.evidence,
    ...Object.keys(knownDelta ?? {}).map((k) => `explicit:${k}`),
  ]
  const turn: ConversationTurn = {
    id: newId('turn', now),
    role: 'user',
    text,
    locale,
    timestamp: (now ?? new Date()).toISOString(),
    slotDelta,
    evidence,
  }
  session.turns.push(turn)
  session.updatedAt = turn.timestamp
  return turn
}

export function recentUserTexts(session: ReflectionSession, limit = 5): string[] {
  return session.turns
    .filter((t) => t.role === 'user')
    .slice(-limit)
    .map((t) => t.text)
}

export function combinedUserText(session: ReflectionSession): string {
  return session.turns
    .filter((t) => t.role === 'user')
    .map((t) => t.text)
    .join('\n')
}

export const ConversationMemory = {
  extractSlotDeltaFromText,
  appendUserTurn,
  recentUserTexts,
  combinedUserText,
}
