/**
 * Sprint 87 — Explainable AI for Destination Knowledge recommendations.
 * Produces confidence, ranking, explanations, preference match, assumptions, alternatives.
 * Structured for future UI — not traveler-facing by default.
 */

import { getDestinationKnowledgeByKey } from './registry'
import type {
  CityKnowledge,
  DestinationAlternative,
  DestinationKnowledge,
  DestinationPreferenceKey,
  ExplainableRecommendation,
  LocalizedText,
  RankedCity,
  TripStyleHint,
} from './types'

const MATCH_THRESHOLD = 7
const UNMATCH_THRESHOLD = 5

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function scoreForStyle(knowledge: DestinationKnowledge | CityKnowledge, style: TripStyleHint): number {
  switch (style) {
    case 'business':
      return knowledge.businessScore
    case 'family':
      return knowledge.familyScore
    case 'honeymoon':
      return knowledge.honeymoonScore
    case 'weekend':
      return Math.max(knowledge.shopping, knowledge.beaches, knowledge.nightlife)
    case 'solo':
      return knowledge.culture
    default:
      return (knowledge.culture + knowledge.beaches + knowledge.shopping) / 3
  }
}

function strongestTrait(city: CityKnowledge): { en: string; ar: string } {
  const entries: Array<{ en: string; ar: string; value: number }> = [
    { en: 'culture', ar: 'ثقافة', value: city.culture },
    { en: 'beaches', ar: 'شاطئ', value: city.beaches },
    { en: 'business', ar: 'أعمال', value: city.businessScore },
    { en: 'family', ar: 'عائلة', value: city.familyScore },
    { en: 'mountains', ar: 'جبال', value: city.mountains },
    { en: 'shopping', ar: 'تسوق', value: city.shopping },
    { en: 'nightlife', ar: 'حياة ليلية', value: city.nightlife },
    { en: 'honeymoon', ar: 'شهر العسل', value: city.honeymoonScore },
  ]
  entries.sort((a, b) => b.value - a.value)
  return { en: entries[0]?.en ?? 'balanced', ar: entries[0]?.ar ?? 'متوازن' }
}

function budgetBandLabel(mid: number): { key: DestinationPreferenceKey; en: string; ar: string } {
  if (mid < 5000) return { key: 'budget_low', en: 'Lower indicative budget band', ar: 'شريحة ميزانية إرشادية أقل' }
  if (mid > 14000) return { key: 'budget_high', en: 'Higher indicative budget band', ar: 'شريحة ميزانية إرشادية أعلى' }
  return { key: 'budget_mid', en: 'Medium indicative budget', ar: 'ميزانية إرشادية متوسطة' }
}

function easyFlights(knowledge: DestinationKnowledge): boolean {
  const text = `${knowledge.flightFromKsa.en} ${knowledge.flightFromKsa.ar}`.toLowerCase()
  return /direct|مباشر|short hop|2–3|2-3|قصيرة/.test(text) || knowledge.airports.some((a) => a.primary)
}

export function inferRequestedPreferences(input: {
  tripStyle: TripStyleHint
  specialRequests?: string | null
  activities?: string[]
}): DestinationPreferenceKey[] {
  const prefs = new Set<DestinationPreferenceKey>()
  prefs.add(input.tripStyle)
  const blob = (input.specialRequests ?? '').toLowerCase()
  if (/beach|شاطئ/.test(blob) || input.activities?.includes('beach')) prefs.add('beaches')
  if (/mountain|جبل|ski|تزلج/.test(blob) || input.activities?.includes('ski')) prefs.add('mountains')
  if (/night|سهر/.test(blob)) prefs.add('nightlife')
  if (/shop|تسوق/.test(blob) || input.activities?.includes('shopping')) prefs.add('shopping')
  if (/culture|ثقافة|museum|متحف/.test(blob) || input.activities?.includes('museum')) {
    prefs.add('culture')
  }
  if (/budget\s*[:=]?\s*[0-9]|ميزانية/.test(blob)) {
    const amount = Number(/([0-9][0-9,]*)/.exec(blob)?.[1]?.replace(/,/g, '') ?? 0)
    if (amount > 0 && amount < 5000) prefs.add('budget_low')
    else if (amount >= 14000) prefs.add('budget_high')
    else if (amount > 0) prefs.add('budget_mid')
  }
  if (input.tripStyle === 'weekend') prefs.add('short_haul')
  if (input.tripStyle === 'family' || input.tripStyle === 'leisure') {
    // Soft desire for workable flights — evaluated as match/unmatch later.
    prefs.add('direct_or_easy_flights')
  }
  return [...prefs]
}

function preferenceSatisfied(
  pref: DestinationPreferenceKey,
  knowledge: DestinationKnowledge,
  subject: CityKnowledge | DestinationKnowledge,
): boolean | null {
  switch (pref) {
    case 'family':
      return subject.familyScore >= MATCH_THRESHOLD
    case 'business':
      return subject.businessScore >= MATCH_THRESHOLD
    case 'honeymoon':
      return subject.honeymoonScore >= MATCH_THRESHOLD
    case 'beaches':
      return subject.beaches >= MATCH_THRESHOLD
    case 'mountains':
      return subject.mountains >= MATCH_THRESHOLD
    case 'nightlife':
      return subject.nightlife >= MATCH_THRESHOLD
    case 'shopping':
      return subject.shopping >= MATCH_THRESHOLD
    case 'culture':
      return subject.culture >= MATCH_THRESHOLD
    case 'weekend':
    case 'solo':
    case 'leisure':
      return scoreForStyle(subject, pref) >= MATCH_THRESHOLD - 1
    case 'budget_low':
      return knowledge.averageBudgetSar.mid < 5000
    case 'budget_mid':
      return knowledge.averageBudgetSar.mid >= 5000 && knowledge.averageBudgetSar.mid <= 14000
    case 'budget_high':
      return knowledge.averageBudgetSar.mid > 14000
    case 'direct_or_easy_flights':
      return easyFlights(knowledge)
    case 'short_haul':
      return /2–3|2-3|short hop|قصيرة/.test(knowledge.flightFromKsa.en.toLowerCase())
    default:
      return null
  }
}

function buildExplanations(input: {
  knowledge: DestinationKnowledge
  subject: CityKnowledge | DestinationKnowledge
  style: TripStyleHint
}): LocalizedText[] {
  const { knowledge, subject, style } = input
  const out: LocalizedText[] = []

  const styleScore = scoreForStyle(subject, style)
  if (style === 'family' && subject.familyScore >= MATCH_THRESHOLD) {
    out.push({
      en: styleScore >= 9 ? 'Excellent family destination' : 'Strong family destination',
      ar: styleScore >= 9 ? 'وجهة ممتازة للعائلة' : 'وجهة قوية للعائلة',
    })
  } else if (style === 'business' && subject.businessScore >= MATCH_THRESHOLD) {
    out.push({
      en: 'Strong business / meetings fit',
      ar: 'ملاءمة قوية للأعمال والاجتماعات',
    })
  } else if (style === 'honeymoon' && subject.honeymoonScore >= MATCH_THRESHOLD) {
    out.push({
      en: 'Strong honeymoon / romantic fit',
      ar: 'ملاءمة قوية لشهر العسل',
    })
  } else if (style === 'weekend') {
    out.push({
      en: 'Fits a short weekend-shaped trip',
      ar: 'تناسب رحلة قصيرة لنهاية الأسبوع',
    })
  } else {
    out.push({
      en: `Good ${style} fit (score ${styleScore.toFixed(0)}/10)`,
      ar: `ملاءمة جيدة لأسلوب ${style} (درجة ${styleScore.toFixed(0)}/10)`,
    })
  }

  if (subject.beaches >= MATCH_THRESHOLD) {
    out.push({
      en: subject.beaches >= 8 ? 'Warm beaches' : 'Beach access',
      ar: subject.beaches >= 8 ? 'شواطئ دافئة' : 'إمكانية شاطئ',
    })
  }
  if (subject.culture >= MATCH_THRESHOLD) {
    out.push({ en: 'Rich culture', ar: 'ثقافة غنية' })
  }
  if (subject.mountains >= MATCH_THRESHOLD) {
    out.push({ en: 'Mountain / nature access', ar: 'إمكانية جبال/طبيعة' })
  }
  if (subject.shopping >= MATCH_THRESHOLD) {
    out.push({ en: 'Strong shopping options', ar: 'خيارات تسوق قوية' })
  }

  const budget = budgetBandLabel(knowledge.averageBudgetSar.mid)
  out.push({ en: budget.en, ar: budget.ar })

  if (easyFlights(knowledge)) {
    const direct = /direct|مباشر/.test(knowledge.flightFromKsa.en.toLowerCase())
    out.push({
      en: direct ? 'Direct flights available (indicative routing)' : 'Convenient flight routing / airports listed',
      ar: direct ? 'رحلات مباشرة متاحة (مسار إرشادي)' : 'مسار طيران مريح / مطارات مدرجة',
    })
  }

  // Deduplicate by English text, keep ≤ 5.
  const seen = new Set<string>()
  const unique: LocalizedText[] = []
  for (const item of out) {
    if (seen.has(item.en)) continue
    seen.add(item.en)
    unique.push(item)
    if (unique.length >= 5) break
  }
  return unique
}

function buildAssumptions(input: {
  style: TripStyleHint
  specialRequests?: string | null
  adults?: number | null
  children?: number | null
  durationDays?: number | null
}): string[] {
  const assumptions: string[] = []
  const blob = (input.specialRequests ?? '').toLowerCase()
  if (!/tripstyle=/.test(blob) && input.style) {
    assumptions.push(`Assumed trip style: ${input.style}`)
  }
  if (input.adults == null && !/adults?|بالغ/.test(blob)) {
    assumptions.push('Assumed traveler party size not confirmed')
  }
  if (input.durationDays == null && !/duration=/.test(blob)) {
    assumptions.push('Assumed recommended duration from destination knowledge')
  }
  if (!/budget|ميزانية/.test(blob)) {
    assumptions.push('Assumed mid-range indicative budget band')
  }
  if (!/202\d-\d{2}-\d{2}|flexible|مرن/.test(blob)) {
    assumptions.push('Assumed flexible dates for preliminary planning')
  }
  assumptions.push('Estimates are indicative — not live quotes or availability')
  return assumptions
}

function buildAlternatives(input: {
  knowledge: DestinationKnowledge
  ranked: RankedCity[]
  subjectKey: string
  style: TripStyleHint
}): DestinationAlternative[] {
  const pool: CityKnowledge[] = [...input.knowledge.cities]
  if (input.knowledge.parentKey) {
    const parent = getDestinationKnowledgeByKey(input.knowledge.parentKey)
    if (parent) {
      for (const city of parent.cities) {
        if (!pool.some((c) => c.key === city.key)) pool.push(city)
      }
    }
  }

  const others = pool
    .filter((c) => c.key !== input.subjectKey)
    .map((city) => {
      const trait = strongestTrait(city)
      const { score } = (() => {
        // Reuse style fit as ranking for alternatives.
        const rankingScore = scoreForStyle(city, input.style) * 3
          + city.culture * 0.4
          + city.beaches * 0.4
          + city.businessScore * 0.4
        return { score: rankingScore }
      })()
      return {
        key: city.key,
        nameEn: city.nameEn,
        nameAr: city.nameAr,
        reasonEn: trait.en,
        reasonAr: trait.ar,
        rankingScore: Math.round(score * 10) / 10,
      }
    })
    .sort((a, b) => b.rankingScore - a.rankingScore)

  // Prefer distinct reasons when possible.
  const picked: DestinationAlternative[] = []
  const usedReasons = new Set<string>()
  for (const alt of others) {
    if (picked.length >= 3) break
    if (usedReasons.has(alt.reasonEn) && picked.length > 0) continue
    usedReasons.add(alt.reasonEn)
    picked.push(alt)
  }
  if (picked.length < 2) {
    for (const alt of others) {
      if (picked.length >= 3) break
      if (!picked.some((p) => p.key === alt.key)) picked.push(alt)
    }
  }
  return picked.slice(0, 3)
}

export function buildExplainableRecommendation(input: {
  knowledge: DestinationKnowledge
  ranked: RankedCity[]
  tripStyle: TripStyleHint
  specialRequests?: string | null
  adults?: number | null
  children?: number | null
  durationDays?: number | null
  activities?: string[]
}): ExplainableRecommendation {
  const top = input.ranked[0]
  const subjectCity = top?.city ?? null
  const subject = subjectCity ?? input.knowledge
  const subjectKey = subjectCity?.key ?? input.knowledge.key
  const subjectNameEn = subjectCity?.nameEn ?? input.knowledge.displayNameEn
  const subjectNameAr = subjectCity?.nameAr ?? input.knowledge.displayNameAr
  const rankingScore = Math.round((top?.score ?? scoreForStyle(input.knowledge, input.tripStyle) * 3) * 10) / 10

  const requested = inferRequestedPreferences({
    tripStyle: input.tripStyle,
    specialRequests: input.specialRequests,
    activities: input.activities,
  })

  const matched: DestinationPreferenceKey[] = []
  const unmatched: DestinationPreferenceKey[] = []
  for (const pref of requested) {
    const ok = preferenceSatisfied(pref, input.knowledge, subject)
    if (ok === true) matched.push(pref)
    else if (ok === false) {
      // Only treat as unmatched when clearly weak.
      const weak =
        pref === 'beaches' ? subject.beaches < UNMATCH_THRESHOLD
          : pref === 'mountains' ? subject.mountains < UNMATCH_THRESHOLD
            : pref === 'nightlife' ? subject.nightlife < UNMATCH_THRESHOLD
              : pref === 'shopping' ? subject.shopping < UNMATCH_THRESHOLD
                : pref === 'culture' ? subject.culture < UNMATCH_THRESHOLD
                  : pref === 'family' ? subject.familyScore < UNMATCH_THRESHOLD
                    : pref === 'business' ? subject.businessScore < UNMATCH_THRESHOLD
                      : pref === 'honeymoon' ? subject.honeymoonScore < UNMATCH_THRESHOLD
                        : ok === false
      if (weak) unmatched.push(pref)
      else matched.push(pref)
    }
  }

  const explanations = buildExplanations({
    knowledge: input.knowledge,
    subject,
    style: input.tripStyle,
  })

  // Confidence: style fit (0-50) + matched prefs (0-30) + logistics (0-15) − unmatched (0-20)
  const styleFit = scoreForStyle(subject, input.tripStyle) / 10 // 0-1
  let confidence = 40 + styleFit * 40
  confidence += Math.min(25, matched.length * 6)
  if (easyFlights(input.knowledge)) confidence += 8
  if (input.knowledge.airports.some((a) => a.primary)) confidence += 4
  confidence -= Math.min(20, unmatched.length * 8)
  if (input.tripStyle === 'leisure' && !/tripstyle=/.test(input.specialRequests ?? '')) {
    confidence -= 4 // style was assumed
  }
  confidence = clamp(confidence, 35, 98)

  return {
    subjectKey,
    subjectNameEn,
    subjectNameAr,
    confidence,
    rankingScore,
    explanations,
    explanationEn: explanations.map((e) => e.en),
    explanationAr: explanations.map((e) => e.ar),
    matchedPreferences: matched,
    unmatchedPreferences: unmatched,
    assumptions: buildAssumptions({
      style: input.tripStyle,
      specialRequests: input.specialRequests,
      adults: input.adults,
      children: input.children,
      durationDays: input.durationDays,
    }),
    alternatives: buildAlternatives({
      knowledge: input.knowledge,
      ranked: input.ranked,
      subjectKey,
      style: input.tripStyle,
    }),
  }
}
