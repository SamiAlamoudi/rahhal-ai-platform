import type { ConversationIntentKind } from './types'

export interface IntentDetectionResult {
  intent: ConversationIntentKind
  confidence: number
}

const RULES: Array<{ intent: ConversationIntentKind; patterns: RegExp[]; confidence: number }> = [
  {
    intent: 'cancel_booking',
    patterns: [/cancel (?:my )?booking/, /ألغ[يي]/, /الغاء الحجز/, /إلغاء الحجز/],
    confidence: 0.92,
  },
  {
    intent: 'emergency',
    patterns: [/emergency/, /طوارئ/, /lost passport/, /جواز ضائع/, /مستشفى|hospital/],
    confidence: 0.9,
  },
  {
    intent: 'visa_question',
    patterns: [/visa/, /تأشير/, /هل أحتاج فيزا/, /do i need a visa/],
    confidence: 0.88,
  },
  {
    intent: 'weather',
    patterns: [/weather/, /طقس/, /climate/, /ممطر|مشمس|بارد|حار/],
    confidence: 0.82,
  },
  {
    intent: 'budget_advice',
    patterns: [/budget advice/, /هل تكفي الميزانية/, /afford/, /كم أحتاج/, /is .* enough/],
    confidence: 0.84,
  },
  {
    intent: 'currency',
    patterns: [/exchange rate/, /currency/, /عملة/, /تحويل عملة/, /دولار إلى|sar to/],
    confidence: 0.85,
  },
  {
    intent: 'packing',
    patterns: [/packing/, /ماذا أحزم/, /what to pack/, /حقيبة/, /ملابس/],
    confidence: 0.8,
  },
  {
    intent: 'airport_info',
    patterns: [/airport/, /مطار/, /terminal/, /lounge/, /صالة المطار/],
    confidence: 0.8,
  },
  {
    intent: 'local_transport',
    patterns: [/metro/, /train/, /taxi/, /uber/, /مواصلات/, /قطار/, /حافلة/, /jr pass/],
    confidence: 0.8,
  },
  {
    intent: 'restaurants',
    patterns: [/restaurant/, /مطعم/, /where to eat/, /طعام/, /dinner/, /lunch/],
    confidence: 0.78,
  },
  {
    intent: 'travel_rules',
    patterns: [/customs/, /قوانين/, /travel rules/, /ممنوع/, /restricted/],
    confidence: 0.78,
  },
  {
    intent: 'modify_trip',
    patterns: [/change (?:my )?trip/, /عدل/, /عدّل/, /modify/, /instead of/, /بدلًا|بدلا/],
    confidence: 0.8,
  },
  {
    intent: 'search_flights',
    patterns: [/flight/, /flights/, /طيران/, /تذكرة/, /airline/, /direct flight/],
    confidence: 0.8,
  },
  {
    intent: 'search_hotels',
    patterns: [/hotel/, /hotels/, /فندق/, /فنادق/, /stay/, /إقامة|اقامة/],
    confidence: 0.8,
  },
  {
    intent: 'travel_inspiration',
    patterns: [/inspire/, /somewhere/, /أين أذهب/, /suggest a destination/, /surprise me/, /مكان هادئ/],
    confidence: 0.75,
  },
  {
    intent: 'complete_trip',
    patterns: [/plan (?:a |my )?trip/, /full trip/, /رحلة كاملة/, /خط[طي]ط/, /complete trip/, /أريد السفر/, /i want to (?:go|travel)/],
    confidence: 0.72,
  },
]

export function detectConversationIntent(userText: string): IntentDetectionResult {
  const text = userText.trim().toLowerCase()
  if (!text) return { intent: 'unknown', confidence: 0 }

  let best: IntentDetectionResult = { intent: 'unknown', confidence: 0 }
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      if (rule.confidence > best.confidence) {
        best = { intent: rule.intent, confidence: rule.confidence }
      }
    }
  }

  // Composite trip cues without a stronger specialized intent
  if (
    best.intent === 'unknown'
    && (/(tokyo|دبي|paris|istanbul|طوكيو|باريس)/i.test(text)
      || /(budget|ميزانية|october|أكتوبر)/i.test(text))
  ) {
    return { intent: 'complete_trip', confidence: 0.65 }
  }

  return best
}

export const IntentDetector = {
  detect: detectConversationIntent,
}
