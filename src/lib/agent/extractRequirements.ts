import type { AgentIntent, AgentLocale, TravelerType, TripRequirements } from './types'
import { detectAgentLocale } from './locale'

const DESTINATION_ALIASES: Array<{ keys: string[]; value: string }> = [
  { keys: ['japan', 'tokyo', 'osaka', 'kyoto', 'اليابان', 'طوكيو', 'اوساكا', 'أوساكا', 'كيوتو'], value: 'Japan' },
  { keys: ['riyadh', 'الرياض'], value: 'Riyadh' },
  { keys: ['jeddah', 'جدة'], value: 'Jeddah' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['paris', 'باريس', 'france', 'فرنسا'], value: 'Paris' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول', 'تركيا', 'turkey'], value: 'Istanbul' },
  { keys: ['london', 'لندن', 'uk', 'britain'], value: 'London' },
  { keys: ['cairo', 'القاهرة', 'egypt', 'مصر'], value: 'Cairo' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['bali', 'بالي', 'indonesia', 'اندونيسيا', 'إندونيسيا'], value: 'Bali' },
]

export interface ExtractionResult {
  locale: AgentLocale
  intent: AgentIntent
  patch: Partial<TripRequirements>
}

export function extractFromUserText(
  text: string,
  fallbackLocale: AgentLocale = 'ar',
): ExtractionResult {
  const locale = detectAgentLocale(text, fallbackLocale)
  const normalized = text.trim()
  const lower = normalized.toLowerCase()
  const intent = detectIntent(lower, locale)
  const patch: Partial<TripRequirements> = {}

  const destination = matchDestination(lower)
  if (destination) {
    patch.destination = destination
    patch.destinations = [destination]
  } else {
    const toMatch = lower.match(/\b(?:to|in)\s+([a-z][a-z\s]{1,40})/)
      || normalized.match(/(?:إلى|الى|في)\s+([^\s،,]{2,40})/)
    if (toMatch?.[1]) {
      const raw = capitalizeDestination(toMatch[1].replace(/[?.!].*$/, '').trim())
      if (raw && !isStopWord(raw)) {
        patch.destination = raw
        patch.destinations = [raw]
      }
    }
  }

  const duration = matchDuration(lower, normalized)
  if (duration != null) patch.durationDays = duration

  if (/\bweekend\b|عطلة نهاية|نهاية الأسبوع|نهاية الاسبوع/.test(lower) || /نهاية\s*الأسبوع/.test(normalized)) {
    patch.durationDays = patch.durationDays ?? 2
  }

  const budget = matchBudget(lower, normalized)
  if (budget) {
    patch.budgetAmount = budget.amount
    patch.budgetCurrency = budget.currency
  }

  const travelers = matchTravelers(lower, normalized)
  if (travelers) {
    patch.travelers = travelers.count
    patch.travelerType = travelers.type
  }

  if (/\bhoneymoon\b|شهر عسل/.test(lower) || /شهر\s*عسل/.test(normalized)) {
    patch.tripPurpose = 'honeymoon'
    patch.travelerType = 'couple'
    patch.travelers = patch.travelers ?? 2
    patch.interests = uniqueInterests([...(patch.interests ?? []), 'romance', 'beach'])
  } else if (/\bbusiness\b|work trip|رحلة عمل|عمل\b/.test(lower) || /رحلة\s*عمل/.test(normalized)) {
    patch.tripPurpose = 'business'
    patch.travelerType = 'business'
    patch.travelers = patch.travelers ?? 1
    patch.interests = uniqueInterests([...(patch.interests ?? []), 'meetings', 'city'])
  } else if (/\bfamily\b|عائلي|عائلة|أطفال|اطفال/.test(lower) || /عائلة/.test(normalized)) {
    patch.tripPurpose = 'family'
    patch.travelerType = 'family'
    // Do not invent party size for "family" unless the user stated a number.
  } else if (/\bcouple\b|زوجين/.test(lower)) {
    patch.travelerType = 'couple'
    patch.travelers = patch.travelers ?? 2
  } else if (/\bsolo\b|alone|وحدي|منفرد/.test(lower)) {
    patch.travelerType = 'solo'
    patch.travelers = patch.travelers ?? 1
  }

  const dates = matchDates(normalized)
  if (dates.start) patch.startDate = dates.start
  if (dates.end) patch.endDate = dates.end

  const interests = matchInterests(lower, normalized)
  if (interests.length) patch.interests = uniqueInterests([...(patch.interests ?? []), ...interests])

  if (intent === 'edit') {
    const noteMatch = normalized.match(/(?:note|notes|ملاحظة|ملاحظات)\s*[:：-]?\s*(.+)$/i)
    if (noteMatch?.[1]) patch.notes = noteMatch[1].trim()
  }

  return { locale, intent, patch }
}

function detectIntent(lower: string, locale: AgentLocale): AgentIntent {
  if (/\bregenerate\b|أعد إنشاء|اعد انشاء|أعد توليد|اعد توليد|جدّد الخطة|جدد الخطة/.test(lower)) {
    return 'regenerate'
  }
  if (/\bsave\b|احفظ|حفظ الخطة|حفظ الرحلة/.test(lower)) return 'save'
  if (/\bedit\b|update\b|change\b|عدّل|عدل|غيّر|غير|حدّث|حدث/.test(lower)) return 'edit'
  if (
    /\bplan\b|\btrip\b|\bvacation\b|\bitinerary\b|\bhoneymoon\b|\bbusiness\b|خط[ةه]|رحل|عطلة|إجازة|اجازة|نهاية|شهر عسل|رحلة عمل/.test(lower)
  ) {
    return 'plan'
  }
  void locale
  return 'answer'
}

function matchDestination(lower: string): string | null {
  for (const entry of DESTINATION_ALIASES) {
    if (entry.keys.some((key) => lower.includes(key))) return entry.value
  }
  return null
}

function matchDuration(lower: string, original: string): number | null {
  const en = lower.match(/(\d+)\s*-?\s*day/)
  if (en) return clampDays(Number(en[1]))
  const ar = original.match(/(\d+)\s*(?:أيام|ايام|يوم)/)
  if (ar) return clampDays(Number(ar[1]))
  const week = lower.match(/(\d+)\s*-?\s*week/) || original.match(/(\d+)\s*(?:أسابيع|اسابيع|أسبوع|اسبوع)/)
  if (week) return clampDays(Number(week[1]) * 7)
  if (/\bone week\b|أسبوع|اسبوع/.test(lower) || /أسبوع|اسبوع/.test(original)) return 7
  return null
}

function matchBudget(lower: string, original: string): { amount: number; currency: string } | null {
  const underEn = lower.match(/(?:under|below|max(?:imum)?|budget)\s*\$?\s*(\d+(?:[.,]\d+)?)/)
  const underAr = original.match(/(?:أقل من|اقل من|تحت|ميزانية|بميزانية)\s*\$?\s*(\d+(?:[.,]\d+)?)/)
  const plainMoney = lower.match(/\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usd|sar|eur|aed|\$)/)
  const raw = underEn?.[1] || underAr?.[1] || plainMoney?.[1] || plainMoney?.[2]
  if (!raw) return null
  const amount = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return null
  let currency = 'USD'
  if (/\bsar\b|ر.?س|ريال/.test(lower) || /ريال/.test(original)) currency = 'SAR'
  else if (/\baed\b|درهم/.test(lower) || /درهم/.test(original)) currency = 'AED'
  else if (/\beur\b|€|يورو/.test(lower)) currency = 'EUR'
  else if (/\$|usd|دولار/.test(lower) || /دولار/.test(original)) currency = 'USD'
  return { amount, currency }
}

function matchTravelers(lower: string, original: string): { count: number; type: TravelerType } | null {
  const en = lower.match(/(\d+)\s*(?:people|persons|travelers|adults|guests)/)
  const ar = original.match(/(\d+)\s*(?:أشخاص|اشخاص|أفراد|افراد|مسافر)/)
  const count = Number(en?.[1] || ar?.[1] || 0)
  if (!count) return null
  let type: TravelerType = 'friends'
  if (count === 1) type = 'solo'
  else if (count === 2) type = 'couple'
  else if (count >= 3) type = 'family'
  return { count, type }
}

function matchDates(text: string): { start: string | null; end: string | null } {
  const iso = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1])
  if (iso.length >= 2) return { start: iso[0], end: iso[1] }
  if (iso.length === 1) return { start: iso[0], end: null }
  return { start: null, end: null }
}

function matchInterests(lower: string, original: string): string[] {
  const catalog: Array<{ keys: string[]; value: string }> = [
    { keys: ['food', 'culinary', 'طعام', 'مطاعم'], value: 'food' },
    { keys: ['museum', 'culture', 'culture', 'متحف', 'ثقافة'], value: 'culture' },
    { keys: ['beach', 'sea', 'شاطئ', 'بحر'], value: 'beach' },
    { keys: ['nature', 'hike', 'طبيعة', 'Hiking'], value: 'nature' },
    { keys: ['shopping', 'تسوق'], value: 'shopping' },
    { keys: ['adventure', 'مغامرة'], value: 'adventure' },
  ]
  const found: string[] = []
  for (const entry of catalog) {
    if (entry.keys.some((k) => lower.includes(k.toLowerCase()) || original.includes(k))) {
      found.push(entry.value)
    }
  }
  return found
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) return 3
  return Math.min(21, Math.max(1, Math.round(value)))
}

function capitalizeDestination(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isStopWord(value: string): boolean {
  return ['A', 'The', 'My', 'Our', 'Trip', 'Plan', 'Weekend', 'Day', 'Days', 'Honeymoon', 'Business'].includes(value)
}

function uniqueInterests(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}
