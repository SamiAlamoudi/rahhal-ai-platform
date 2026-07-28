/**
 * Greeting / clean-session helpers for Conversation Brain.
 * Prevents inventing travelers, budget, destination, dates on hello turns.
 */

const GREETING_RE =
  /^(?:\s*(?:السلام\s*عليكم|سلام\s*عليكم|السلام|مرحبا(?:ً|ا)?|أهلا(?:ً|ا)?(?:\s*بكم)?|هلا(?: والله)?|صباح الخير|مساء الخير|hi|hello|hey|good\s*(?:morning|evening)|assalamu?\s*alaykum)[.!?؟!…\s]*)+$/i

export function isGreetingOnly(text: string): boolean {
  const t = (text || '').trim()
  if (!t || t.length > 64) return false
  return GREETING_RE.test(t)
}

/** Travel facts that must never be invented — only user-stated or confirmed. */
export function replyInventedTravelFacts(text: string): string[] {
  const t = (text || '').trim()
  if (!t) return []
  const hits: string[] = []
  if (/(?:ميزانية|budget|\$|دولار|ريال|SAR|USD)\s*(?:حوالي|تقارب|around)?\s*\d[\d,]*/i.test(t)
    || /\d[\d,]*\s*(?:ألف|الف|\$|دولار|ريال|USD|SAR)/i.test(t)
    || /عشرة\s*آلاف|١٠٠٠٠|10000/i.test(t)) {
    hits.push('budget')
  }
  if (/(?:لشخصين|شخصين|فردين|ثنائي|زوجين|two\s*(?:people|persons|adults|travelers)|couple|family\s*of|\d+\s*(?:أشخاص|اشخاص|مسافر|persons|travelers|adults))/i.test(t)) {
    hits.push('travelers')
  }
  if (/(?:إسطنبول|اسطنبول|المغرب|مراكش|دبي|باريس|لندن|istanbul|morocco|dubai|paris|tokyo|japan)/i.test(t)) {
    hits.push('destination')
  }
  if (/(?:\d+\s*أيام|\d+\s*يوم|أسبوع|أسبوعين|duration|days?\b|from\s+\d|تاريخ|شهر\s+)/i.test(t)) {
    hits.push('dates')
  }
  if (/(?:خط[ةه]\s*الرحلة|itinerary|جدول\s*(?:اليوم|الرحلة)|فنادق\s*مركزية)/i.test(t)) {
    hits.push('itinerary')
  }
  return [...new Set(hits)]
}

export function hasConfirmedHardFacts(known: {
  destination?: string | null
  destinations?: string[] | null
  durationDays?: number | null
  travelers?: number | null
  budgetAmount?: number | null
  origin?: string | null
  startDate?: string | null
  endDate?: string | null
  tripPurpose?: string | null
}): boolean {
  return Boolean(
    known.destination
    || (known.destinations && known.destinations.length > 0)
    || known.durationDays != null
    || known.travelers != null
    || known.budgetAmount != null
    || known.origin
    || known.startDate
    || known.endDate
    || known.tripPurpose,
  )
}
