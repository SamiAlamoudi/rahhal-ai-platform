/**
 * Sprint 52 — Negotiation helpers (consultant alternatives instead of "no").
 */

import type { NegotiationSuggestion } from './types'
import type { ScoredOption } from './types'
import type { DestinationIntelligence } from './types'

export function buildNegotiationSuggestions(input: {
  locale: 'ar' | 'en'
  userText: string
  budgetAmount: number | null
  strongest: ScoredOption[]
  primaryIntel: DestinationIntelligence | null
  rejectedMention: string | null
}): NegotiationSuggestion[] {
  const { locale, userText, budgetAmount, strongest, primaryIntel, rejectedMention } = input
  const suggestions: NegotiationSuggestion[] = []
  const ar = locale === 'ar'
  const top = strongest[0]
  const alt = strongest[1]

  if (/no|not |can't|cannot|won't|مستحيل|ما أبي|لا أريد|رفض/.test(userText.toLowerCase()) && rejectedMention && alt) {
    suggestions.push({
      kind: 'destination',
      betterThan: rejectedMention,
      message: ar
        ? `بدل ${rejectedMention}، أقترح ${alt.name} — تناسب أوضح مع أهدافك.`
        : `Instead of ${rejectedMention}, I recommend ${alt.name} — a clearer fit for your goals.`,
    })
  }

  if (budgetAmount && top && (top.objectives.price ?? 1) < 0.55) {
    suggestions.push({
      kind: 'budget',
      betterThan: `${budgetAmount} SAR`,
      message: ar
        ? `الميزانية الحالية ضيقة على ${top.name}. أرفعها قليلاً أو نختار وجهة أقرب سعراً مثل ${alt?.name ?? 'خيار اقتصادي'}.`
        : `Current budget is tight for ${top.name}. Raise it slightly or switch to a closer-priced option like ${alt?.name ?? 'a value destination'}.`,
    })
  }

  if (primaryIntel && primaryIntel.visa === 'embassy') {
    suggestions.push({
      kind: 'timing',
      betterThan: primaryIntel.nameEn,
      message: ar
        ? `تأشيرة ${primaryIntel.nameEn} تحتاج وقتاً سفارة. إن كان الوقت ضيقاً، نؤجل السفر أسبوعين أو نختار وجهة بتأشيرة إلكترونية.`
        : `${primaryIntel.nameEn} needs embassy timing. If you are short on time, delay two weeks or pick an e-visa destination.`,
    })
  }

  if (primaryIntel && primaryIntel.flightAccessibility < 0.45) {
    suggestions.push({
      kind: 'airport',
      betterThan: primaryIntel.nameEn,
      message: ar
        ? `الوصول إلى ${primaryIntel.nameEn} طويل. أقترح مطاراً إقليمياً أقرب أو مساراً عبر محور قصير.`
        : `Access to ${primaryIntel.nameEn} is long-haul. Consider a nearer regional airport or a short hub routing.`,
    })
  }

  if (primaryIntel && primaryIntel.luxuryScore < 0.5 && /luxury|فاخر|five.?star/.test(userText.toLowerCase())) {
    suggestions.push({
      kind: 'hotel',
      betterThan: primaryIntel.nameEn,
      message: ar
        ? `${primaryIntel.nameEn} ليست الأقوى فخامة. أرشّح منتجعاً أعلى تصنيفاً أو وجهة برفاهية أوضح.`
        : `${primaryIntel.nameEn} is not the strongest luxury fit. I suggest a higher-tier resort or a clearer luxury destination.`,
    })
  }

  if (primaryIntel && primaryIntel.flightAccessibility < 0.6) {
    suggestions.push({
      kind: 'routing',
      betterThan: 'direct-only',
      message: ar
        ? 'إن تعذّر المباشر، مسار بمحطة واحدة قصيرة غالباً أوفر وأكثر توفراً دون خسارة كبيرة للراحة.'
        : 'If nonstop is scarce, a single short connection is often better value without a large comfort penalty.',
    })
  }

  if (suggestions.length === 0 && alt && top) {
    suggestions.push({
      kind: 'destination',
      betterThan: top.name,
      message: ar
        ? `إن لم يناسبك ${top.name}، ${alt.name} بديل قوي بنفس الأهداف تقريباً.`
        : `If ${top.name} is not ideal, ${alt.name} is a strong alternative with similar goals.`,
    })
  }

  return suggestions.slice(0, 4)
}
