import type { BrainLocale, IntentClassification, TravelIntent } from './types'

type Rule = {
  intent: TravelIntent
  weight: number
  patterns: RegExp[]
}

const RULES: Rule[] = [
  {
    intent: 'SearchFlights',
    weight: 0.92,
    patterns: [
      /\bflights?\b|\bairfare\b|\btickets?\b|طيران|تذكرة|تذاكر|رحلة جوية/,
      /\bfly\b|\bflying\b|احجز.*طيران|ابحث.*طيران/,
    ],
  },
  {
    intent: 'SearchHotels',
    weight: 0.9,
    patterns: [/\bhotels?\b|\bstay\b|\baccommodation\b|فندق|فنادق|إقامة|اقامة|سكن/],
  },
  {
    intent: 'SearchPackages',
    weight: 0.88,
    patterns: [/\bpackages?\b|\bbundle\b|باقة|باقات|حزمة|full package|رحلة متكاملة/],
  },
  {
    intent: 'ModifyTrip',
    weight: 0.9,
    patterns: [/\bmodify\b|\bchange\b|\bupdate (?:my )?trip\b|تعديل|غير|غيّر|تغيير الرحلة/],
  },
  {
    intent: 'CancelBooking',
    weight: 0.93,
    patterns: [/\bcancel\b|إلغاء|الغاء|ألغ|الغِ|cancel (?:my )?booking/],
  },
  {
    intent: 'ContinueBooking',
    weight: 0.9,
    patterns: [/\bcontinue\b|\bresume\b|أكمل|اكمل|متابعة|استمر|continue booking/],
  },
  {
    intent: 'AskRecommendation',
    weight: 0.85,
    patterns: [/\brecommend\b|\bsuggest\b|اقترح|توصية|وين أنصح|what do you (?:recommend|suggest)/],
  },
  {
    intent: 'VisaQuestion',
    weight: 0.92,
    patterns: [/\bvisa\b|تأشيرة|تاشيرة|فيزا|visa (?:required|needed)/],
  },
  {
    intent: 'WeatherQuestion',
    weight: 0.9,
    patterns: [/\bweather\b|\bforecast\b|\btemperature\b|طقس|الجو|درجة الحرارة/],
  },
  {
    intent: 'BudgetPlanning',
    weight: 0.88,
    patterns: [/\bbudget\b|\bcost\b|\bhow much\b|ميزانية|كم يكلف|التكلفة|سعر تقريبي/],
  },
  {
    intent: 'PackingAdvice',
    weight: 0.9,
    patterns: [/\bpack(?:ing)?\b|\bwhat to (?:bring|pack)\b|شنطة|حقائب|ماذا أحمل|ماذا اخذ|ملابس/],
  },
  {
    intent: 'TravelAdvice',
    weight: 0.8,
    patterns: [/\badvice\b|\btips?\b|\bguide\b|نصيحة|نصائح|إرشاد|ارشاد/],
  },
]

/**
 * IntentClassifier — rule-based travel intent detection (no LLM).
 */
export function IntentClassifier(input: {
  text: string
  locale?: BrainLocale
}): IntentClassification {
  const text = input.text.trim()
  const lower = text.toLowerCase()
  let best: IntentClassification = {
    intent: 'GeneralConversation',
    confidence: 0.35,
    signals: ['fallback'],
  }

  for (const rule of RULES) {
    const hits = rule.patterns.filter((p) => p.test(lower) || p.test(text))
    if (hits.length === 0) continue
    const confidence = Math.min(0.99, rule.weight + (hits.length - 1) * 0.03)
    if (confidence > best.confidence) {
      best = {
        intent: rule.intent,
        confidence,
        signals: hits.map((h) => h.source.slice(0, 40)),
      }
    }
  }

  // Soft destination-seeking without explicit search verbs → recommendation.
  if (
    best.intent === 'GeneralConversation' &&
    (/\b(?:to|in)\s+[a-z]/i.test(lower) || /(?:إلى|الى|في)\s+\S+/.test(text))
  ) {
    best = {
      intent: 'AskRecommendation',
      confidence: 0.55,
      signals: ['destination_mention'],
    }
  }

  return best
}
