import type { LocaleCode } from '../types'
import { clamp01 } from '../types'
import type { DetectedIntent, TravelIntentId } from './intents'

type Pattern = {
  id: TravelIntentId
  en: RegExp[]
  ar: RegExp[]
}

const PATTERNS: Pattern[] = [
  {
    id: 'book_flight',
    en: [/\bbook\b.*\bflight/, /\bflight\b.*\b(to|from)\b/, /\bfly\b.*\bto\b/],
    ar: [/حجز.*طيران/, /تذكرة.*طيران/, /طيران.*(إلى|من)/],
  },
  {
    id: 'book_hotel',
    en: [/\bbook\b.*\bhotel/, /\bhotel\b.*\b(in|near)\b/, /\bstay\b.*\bin\b/],
    ar: [/حجز.*فندق/, /فندق.*(في|ب)/, /سكن.*(في|ب)/],
  },
  {
    id: 'book_package',
    en: [/\bpackage\b/, /\bbundle\b.*\btrip/, /\ball[- ]inclusive\b/],
    ar: [/باقة/, /رحلة.*شاملة/, /باكج/],
  },
  {
    id: 'search_destination',
    en: [/\bwhere\b.*\b(go|travel)/, /\bdestination\b/, /\bsuggest\b.*\b(place|city)/],
    ar: [/وين\s*أ?روح/, /وجهة/, /اقترح.*(مدينة|وجهة)/],
  },
  {
    id: 'visa',
    en: [/\bvisa\b/, /\bentry\b.*\brequirement/],
    ar: [/تأشيرة/, /فيزا/, /متطلبات.*دخول/],
  },
  {
    id: 'weather',
    en: [/\bweather\b/, /\btemperature\b/, /\brain\b.*\bforecast/],
    ar: [/طقس/, /الجو/, /درجة.*حرارة/],
  },
  {
    id: 'budget_planning',
    en: [/\bbudget\b/, /\bhow much\b.*\bcost/, /\bafford\b/],
    ar: [/ميزانية/, /كم.*يكلف/, /تكلفة/],
  },
  {
    id: 'price_prediction',
    en: [/\bprice\b.*\b(predict|forecast|drop|rise)/, /\bwhen\b.*\bcheapest/],
    ar: [/توقع.*سعر/, /متى.*أرخص/, /سعر.*ينزل/],
  },
  {
    id: 'modify_trip',
    en: [/\bchange\b.*\b(trip|flight|hotel)/, /\bmodify\b/, /\breschedule\b/],
    ar: [/عدّل|عدل/, /غيّر|غير/, /إعادة.*جدولة/],
  },
  {
    id: 'cancel_booking',
    en: [/\bcancel\b.*\b(booking|reservation|trip)/, /\brefund\b/],
    ar: [/إلغاء.*حجز/, /الغي/, /استرداد/],
  },
  {
    id: 'recommendations',
    en: [/\brecommend/, /\bsuggest\b.*\b(option|hotel|flight)/, /\bbest\b.*\bfor\b/],
    ar: [/اقترح/, /رشّح|رشح/, /أفضل.*(خيار|فندق|طيران)/],
  },
  {
    id: 'transportation',
    en: [/\btransfer\b/, /\btransport/, /\btaxi\b/, /\btrain\b/],
    ar: [/تنقّل|تنقل/, /مواصلات/, /تاكسي/, /قطار/],
  },
  {
    id: 'restaurants',
    en: [/\brestaurant/, /\bdine\b/, /\bfood\b.*\b(place|spot)/],
    ar: [/مطعم/, /مطاعم/, /عشاء|غداء/],
  },
  {
    id: 'activities',
    en: [/\bactivit/, /\bthings to do\b/, /\btour\b/, /\bexperience\b/],
    ar: [/نشاط/, /أنشطة/, /جولة/, /تجارب/],
  },
  {
    id: 'emergency',
    en: [/\bemergency\b/, /\burgent\b/, /\bstolen\b/, /\blost passport\b/],
    ar: [/طوارئ/, /عاجل/, /سرقة/, /جواز.*ضاع/],
  },
  {
    id: 'travel_advice',
    en: [/\badvice\b/, /\btip\b/, /\bshould i\b/, /\bis it safe\b/],
    ar: [/نصيحة/, /نصائح/, /هل\s*آمن/, /وش\s*تنصح/],
  },
]

function detectLocale(text: string): LocaleCode {
  return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en'
}

export function detectIntent(text: string): DetectedIntent {
  const locale = detectLocale(text)
  const normalized = text.trim().toLowerCase()
  let best: DetectedIntent = {
    id: 'unknown',
    confidence: 0,
    locale,
    matchedSignals: [],
  }

  for (const pattern of PATTERNS) {
    const regs = locale === 'ar' ? pattern.ar : pattern.en
    const hits: string[] = []
    for (const re of regs) {
      if (re.test(normalized) || re.test(text)) hits.push(re.source)
    }
    if (hits.length === 0) continue
    const confidence = clamp01(0.55 + hits.length * 0.15)
    if (confidence > best.confidence) {
      best = { id: pattern.id, confidence, locale, matchedSignals: hits }
    }
  }

  return best
}

export class IntentEngine {
  recognize(text: string): DetectedIntent {
    return detectIntent(text)
  }
}
