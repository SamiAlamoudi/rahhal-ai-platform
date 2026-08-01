/**
 * Sprint 81 — IntentDetector (Brain v1).
 * Rule-based foundation. Not connected to production planTurn.
 */

import type { BrainV1Intent, BrainV1IntentResult } from './types'

type Rule = { intent: BrainV1Intent; patterns: RegExp[]; confidence: number }

const RULES: Rule[] = [
  {
    intent: 'cancellation',
    patterns: [/cancel/, /cancellation/, /إلغاء/, /الغاء/, /ألغ[يي]/],
    confidence: 0.93,
  },
  {
    intent: 'booking_modification',
    patterns: [/modify|change (?:my )?booking|change (?:my )?trip/, /تعديل|عدّل|عدل الحجز|بدل/],
    confidence: 0.9,
  },
  {
    intent: 'visa_question',
    patterns: [/visa/, /تأشير/, /فيزا/, /do i need a visa/],
    confidence: 0.9,
  },
  {
    intent: 'price_prediction',
    patterns: [/price prediction|will prices? (?:go|rise|drop)/, /توقع السعر|هل السعر يرتفع|يتوقع/],
    confidence: 0.86,
  },
  {
    intent: 'price_comparison',
    patterns: [/compare (?:prices?|flights?|hotels?)/, /مقارنة|قارن|أرخص|cheapest/],
    confidence: 0.84,
  },
  {
    intent: 'multi_city_trip',
    patterns: [/multi[- ]?city|several cities|أكثر من مدينة|مدن متعددة|ثم إلى|then to/],
    confidence: 0.88,
  },
  {
    intent: 'business_travel',
    patterns: [/business (?:trip|travel)|رحلة عمل|عمل رسمي|conference/],
    confidence: 0.87,
  },
  {
    intent: 'family_vacation',
    patterns: [/family (?:trip|vacation)|عائلة|أطفال|kids|children|عائلة كبيرة/],
    confidence: 0.85,
  },
  {
    intent: 'weekend_trip',
    patterns: [/weekend|عطلة نهاية|نهاية الأسبوع|friday.*sunday|خميس.*جمعة/],
    confidence: 0.85,
  },
  {
    intent: 'package_search',
    patterns: [/package|باقة|عرض شامل|flight.?hotel|طيران.?فندق/],
    confidence: 0.84,
  },
  {
    intent: 'budget_planning',
    patterns: [/budget plan|تخطيط الميزانية|كم أحتاج|afford|ميزانيتي/],
    confidence: 0.83,
  },
  {
    intent: 'hotel_search',
    patterns: [/hotel|فنادق|فندق|إقامة|اقامة|riads?|منتجع|resort/],
    confidence: 0.82,
  },
  {
    intent: 'flight_search',
    patterns: [/flight|طيران|تذكرة|airline|مباشر|direct flight|من .+ إلى/],
    confidence: 0.8,
  },
  {
    intent: 'travel_advice',
    patterns: [/advice|نصيح|recommend|اقترح|أين أذهب|where should i|أريد رحلة|ابي رحلة|أبغى رحلة/],
    confidence: 0.78,
  },
  {
    intent: 'general_conversation',
    patterns: [/hello|hi|مرحبا|السلام|شكرا|thanks|كيفك|هلا/],
    confidence: 0.7,
  },
]

export class IntentDetector {
  detect(text: string): BrainV1IntentResult {
    const normalized = text.trim().toLowerCase()
    if (!normalized) {
      return { intent: 'unknown', confidence: 0, secondary: [] }
    }

    const hits: Array<{ intent: BrainV1Intent; confidence: number }> = []
    for (const rule of RULES) {
      if (rule.patterns.some((p) => p.test(normalized) || p.test(text))) {
        hits.push({ intent: rule.intent, confidence: rule.confidence })
      }
    }

    if (hits.length === 0) {
      // Destination-only utterances still map toward travel advice / flight search.
      if (/morocco|دبي|paris|tokyo|istanbul|المغرب|باريس|طوكيو|الى |إلى /.test(normalized)) {
        return { intent: 'flight_search', confidence: 0.55, secondary: ['travel_advice'] }
      }
      return { intent: 'unknown', confidence: 0.2, secondary: [] }
    }

    hits.sort((a, b) => b.confidence - a.confidence)
    const primary = hits[0]!
    const secondary = hits.slice(1, 4).map((h) => h.intent)
    return { intent: primary.intent, confidence: primary.confidence, secondary }
  }
}

export function createIntentDetector(): IntentDetector {
  return new IntentDetector()
}
