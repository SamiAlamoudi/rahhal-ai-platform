/**
 * Normalize dialect want / travel / book / vacation verbs → canonical MSA cues.
 */

import type { DialectRewriteRule } from '../types'

/** Shared across dialects — Intelligence Layer only sees replacements. */
export const INTENT_REWRITE_RULES: DialectRewriteRule[] = [
  // Want / desire
  {
    id: 'want.saudi_gulf',
    pattern: /(?:^|[\s،,])(?:أبغى|أبغي|ابغى|ابغي|أبي|ابي|أبا|ابا|تبي|تبغى)(?=[\s،,]|$)/gu,
    replace: ' أريد ',
  },
  {
    id: 'want.saudi_waddi',
    pattern: /(?:^|[\s،,])ودي(?=[\s،,]|$)/gu,
    replace: ' أريد ',
  },
  {
    id: 'want.hab',
    pattern: /(?:^|[\s،,])(?:حاب|حابب|حابه|حابّ)(?=[\s،,]|$)/gu,
    replace: ' أريد ',
  },
  {
    id: 'want.egyptian',
    pattern: /(?:^|[\s،,])(?:عايز|عاوز|عايزة|عاوزة|عايزين)(?=[\s،,]|$)/gu,
    replace: ' أريد ',
  },
  {
    id: 'want.levantine',
    // Keep "بدنا اثنين" for traveler normalization; only rewrite bare want verbs.
    pattern: /(?:^|[\s،,])(?:بدّي|بدي|بدو|بدها)(?=[\s،,]|$)|(?:^|[\s،,])بدنا(?!\s*(?:اثنين|اتنين|\d))(?=[\s،,]|$)/gu,
    replace: ' أريد ',
  },
  {
    id: 'want.maghreb_yemen',
    pattern: /(?:^|[\s،,])(?:بغيت|نحب|راني\s*نحب)(?=[\s،,]|$)/gu,
    replace: ' أريد ',
  },
  {
    id: 'want.sudanese',
    pattern: /(?:^|[\s،,])(?:حا\s*أمشي|عاوز\s*أمشي)(?=[\s،,]|$)/gu,
    replace: ' أريد السفر ',
  },
  // Travel / fly / go
  {
    id: 'travel.fly',
    pattern: /(?:^|[\s،,])(?:أسافر|اسافر|نسافر|نطلع|أطلع|اطلع|نروح|أروح|اروح|أمشي|نمشي)(?=[\s،,]|$)/gu,
    replace: ' السفر ',
  },
  {
    id: 'travel.phrase',
    pattern: /أبغى\s*أسافر|ابغى\s*اسافر|عايز\s*أسافر|عايز\s*اسافر|بدي\s*أسافر|بدي\s*سافر/gu,
    replace: 'أريد السفر',
  },
  // Book / reserve
  {
    id: 'book.reserve',
    pattern: /(?:^|[\s،,])(?:أحجز|احجز|نحجز|احجزي|أوكّد|اوكل|احجزلي)(?=[\s،,]|$)/gu,
    replace: ' حجز ',
  },
  // Vacation / holiday
  {
    id: 'vacation.holiday',
    pattern: /(?:^|[\s،,])(?:عطلتي|عطلة|إجازتي|اجازتي|أجازة|اجازة|هولدِي|هولايدي)(?=[\s،,]|$)/gu,
    replace: ' إجازة ',
  },
]

export function normalizeIntentPhrases(text: string): { text: string; changed: boolean; travelIntent: boolean } {
  let out = text
  let changed = false
  for (const rule of INTENT_REWRITE_RULES) {
    const next = out.replace(rule.pattern, (m) => {
      const value = typeof rule.replace === 'function' ? rule.replace(m) : rule.replace
      return value
    })
    if (next !== out) {
      changed = true
      out = next
    }
  }
  out = out.replace(/\s+/g, ' ').trim()
  const travelIntent = changed
    || /أريد|السفر|حجز|إجازة|رحل|طيران|travel|fly|book|vacation|holiday/i.test(out)
  return { text: out, changed, travelIntent }
}
