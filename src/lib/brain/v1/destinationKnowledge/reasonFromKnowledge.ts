/**
 * Sprint 87 — Reason over Destination Knowledge (no hardcoded city essays).
 * City rankings, contrast, itinerary, and style notes are derived from scores.
 */

import type { TravelPlanSlots } from '../planning/types'
import { buildExplainableRecommendation } from './explainability'
import { getDestinationKnowledgeByKey, resolveDestinationKnowledgeKey } from './registry'
import type {
  CityKnowledge,
  DestinationKnowledge,
  DestinationReasoning,
  RankedCity,
  TripStyleHint,
} from './types'

export function inferTripStyle(params: {
  durationDays?: number | null
  specialRequests?: string | null
  travelerProfileHint?: string | null
  adults?: number | null
  children?: number | null
}): TripStyleHint {
  const blob = `${params.specialRequests ?? ''} ${params.travelerProfileHint ?? ''}`.toLowerCase()
  if (/tripstyle=business|\bbusiness\b|عمل|أعمال/.test(blob)) return 'business'
  if (/tripstyle=honeymoon|شهر العسل|honeymoon/.test(blob)) return 'honeymoon'
  if (/tripstyle=weekend|نهاية أسبوع|\bweekend\b/.test(blob)) return 'weekend'
  if (
    /tripstyle=family|عائلة|عائلية|with (?:my )?kids|مع الأطفال|\bfamily\b/.test(blob)
    || (params.children != null && params.children > 0)
  ) {
    return 'family'
  }
  if (/tripstyle=solo|فردي|\bsolo\b/.test(blob)) return 'solo'
  if (params.durationDays != null && params.durationDays > 0 && params.durationDays <= 3) {
    return 'weekend'
  }
  if (/duration=([123])\b/.test(blob)) return 'weekend'
  return 'leisure'
}

export function readTaggedDuration(specialRequests?: string | null): number | null {
  const m = specialRequests?.match(/duration=(\d+)/i)
  return m ? Number(m[1]) : null
}

function styleWeights(style: TripStyleHint): Record<string, number> {
  switch (style) {
    case 'business':
      return { businessScore: 3, shopping: 0.8, culture: 0.5, nightlife: 0.4 }
    case 'family':
      return { familyScore: 3, beaches: 1.2, culture: 0.8, mountains: 0.7, nightlife: -0.6 }
    case 'honeymoon':
      return { honeymoonScore: 3, beaches: 1.4, culture: 1, nightlife: 0.6, mountains: 0.8 }
    case 'weekend':
      return { shopping: 1.2, nightlife: 1, beaches: 1, culture: 0.8, businessScore: 0.3 }
    case 'solo':
      return { culture: 1.5, nightlife: 1, shopping: 0.7, beaches: 0.6, mountains: 0.6 }
    default:
      return { culture: 1.4, beaches: 1.1, shopping: 0.9, mountains: 0.7, nightlife: 0.6 }
  }
}

function cityScore(city: CityKnowledge, style: TripStyleHint): { score: number; reasonsEn: string[]; reasonsAr: string[] } {
  const weights = styleWeights(style)
  let score = 0
  const reasonsEn: string[] = []
  const reasonsAr: string[] = []

  const push = (value: number, weight: number, labelEn: string, labelAr: string) => {
    score += value * weight
    if (weight > 0 && value >= 7) {
      reasonsEn.push(labelEn)
      reasonsAr.push(labelAr)
    }
  }

  push(city.businessScore, weights.businessScore ?? 0, 'business access', 'سهولة للأعمال')
  push(city.familyScore, weights.familyScore ?? 0, 'family-friendly', 'مناسب للعائلة')
  push(city.honeymoonScore, weights.honeymoonScore ?? 0, 'romantic stay', 'إقامة رومانسية')
  push(city.beaches, weights.beaches ?? 0, 'beaches', 'شاطئ')
  push(city.mountains, weights.mountains ?? 0, 'mountains', 'جبال')
  push(city.nightlife, weights.nightlife ?? 0, 'nightlife', 'حياة ليلية')
  push(city.shopping, weights.shopping ?? 0, 'shopping', 'تسوق')
  push(city.culture, weights.culture ?? 0, 'culture', 'ثقافة')

  // Trait labels as soft reasons when score-based reasons are thin.
  if (reasonsEn.length === 0 && city.traitsEn[0]) {
    reasonsEn.push(city.traitsEn[0])
    reasonsAr.push(city.traitsAr[0] ?? city.traitsEn[0])
  }

  return { score, reasonsEn: reasonsEn.slice(0, 2), reasonsAr: reasonsAr.slice(0, 2) }
}

function rankCities(knowledge: DestinationKnowledge, style: TripStyleHint): RankedCity[] {
  const ranked = knowledge.cities.map((city) => {
    const { score, reasonsEn, reasonsAr } = cityScore(city, style)
    return { city, score, reasonsEn, reasonsAr }
  })
  ranked.sort((a, b) => b.score - a.score)
  // Weekend / business: fewer cities.
  const limit = style === 'weekend' || style === 'business' ? 2 : Math.min(4, ranked.length)
  return ranked.slice(0, Math.max(1, limit))
}

function buildCityContrast(ranked: RankedCity[]): { en: string; ar: string } {
  if (ranked.length <= 1) {
    const only = ranked[0]
    if (!only) return { en: '', ar: '' }
    return {
      en: `${only.city.nameEn} fits this trip focus (${only.reasonsEn.join(', ') || only.city.traitsEn.join(', ')}).`,
      ar: `${only.city.nameAr} تناسب تركيز هذه الرحلة (${only.reasonsAr.join('، ') || only.city.traitsAr.join('، ')}).`,
    }
  }
  const en = ranked
    .map((r) => `${r.city.nameEn} (${r.reasonsEn.join(', ') || r.city.traitsEn[0] || 'balanced'})`)
    .join('; ')
  const ar = ranked
    .map((r) => `${r.city.nameAr} (${r.reasonsAr.join('، ') || r.city.traitsAr[0] || 'متوازن'})`)
    .join('؛ ')
  return {
    en: `Based on destination scores: ${en}.`,
    ar: `بناءً على بيانات الوجهة: ${ar}.`,
  }
}

function buildItinerary(ranked: RankedCity[], duration: number): { en: string[]; ar: string[] } {
  const cities = ranked.slice(0, duration <= 3 ? 1 : duration <= 6 ? 2 : 3)
  const totalSuggested = cities.reduce((s, c) => s + c.city.suggestedDays, 0) || 1
  const en: string[] = []
  const ar: string[] = []
  let remaining = duration
  for (const [index, row] of cities.entries()) {
    const isLast = index === cities.length - 1
    const share = isLast
      ? Math.max(1, remaining)
      : Math.max(1, Math.round((row.city.suggestedDays / totalSuggested) * duration))
    remaining -= share
    const highlightEn = row.city.highlightsEn?.[0] ?? row.reasonsEn[0] ?? row.city.traitsEn[0] ?? 'explore'
    const highlightAr = row.city.highlightsAr?.[0] ?? row.reasonsAr[0] ?? row.city.traitsAr[0] ?? 'استكشاف'
    en.push(`${share} day${share > 1 ? 's' : ''} ${row.city.nameEn}: ${highlightEn}`)
    ar.push(`${share} ${share > 1 ? 'أيام' : 'يوم'} ${row.city.nameAr}: ${highlightAr}`)
  }
  return { en, ar }
}

function buildStyleNote(knowledge: DestinationKnowledge, style: TripStyleHint, ranked: RankedCity[]): LocalizedPair {
  const top = ranked[0]?.city.nameEn
  const topAr = ranked[0]?.city.nameAr
  const scores = knowledge
  switch (style) {
    case 'business':
      return {
        en: `Business fit score ${scores.businessScore}/10${top ? ` — prioritize ${top}` : ''}.`,
        ar: `ملاءمة الأعمال ${scores.businessScore}/10${topAr ? ` — ركّز على ${topAr}` : ''}.`,
      }
    case 'family':
      return {
        en: `Family fit score ${scores.familyScore}/10${top ? ` — lean toward ${top}` : ''}.`,
        ar: `ملاءمة العائلة ${scores.familyScore}/10${topAr ? ` — الأفضل نحو ${topAr}` : ''}.`,
      }
    case 'honeymoon':
      return {
        en: `Honeymoon fit score ${scores.honeymoonScore}/10${top ? ` — ${top} leads on romance/pace` : ''}.`,
        ar: `ملاءمة شهر العسل ${scores.honeymoonScore}/10${topAr ? ` — ${topAr} الأنسب للهدوء/الرومانسية` : ''}.`,
      }
    case 'weekend':
      return {
        en: `Short-trip shape: keep to ${ranked.length} area${ranked.length > 1 ? 's' : ''} max (shopping ${scores.shopping}/10, nightlife ${scores.nightlife}/10).`,
        ar: `رحلة قصيرة: حدّد ${ranked.length} منطقة كحد أقصى (تسوق ${scores.shopping}/10، حياة ليلية ${scores.nightlife}/10).`,
      }
    case 'solo':
      return {
        en: `Solo-friendly culture ${scores.culture}/10 and walkability cues from city traits.`,
        ar: `مناسبة للفردي: ثقافة ${scores.culture}/10 مع إمكانية مشي جيدة حسب بيانات المدن.`,
      }
    default:
      return {
        en: `Leisure balance — culture ${scores.culture}/10, beaches ${scores.beaches}/10, mountains ${scores.mountains}/10.`,
        ar: `توازن سياحي — ثقافة ${scores.culture}/10، شواطئ ${scores.beaches}/10، جبال ${scores.mountains}/10.`,
      }
  }
}

type LocalizedPair = { en: string; ar: string }

function airportSummary(knowledge: DestinationKnowledge): LocalizedPair {
  if (!knowledge.airports.length) {
    return { en: 'Airport details not listed yet.', ar: 'تفاصيل المطارات غير مدرجة بعد.' }
  }
  const primary = knowledge.airports.filter((a) => a.primary)
  const list = (primary.length ? primary : knowledge.airports).slice(0, 3)
  return {
    en: list.map((a) => `${a.code} (${a.nameEn})`).join(', '),
    ar: list.map((a) => `${a.code} (${a.nameAr})`).join('، '),
  }
}

function adjustBudget(mid: number, style: TripStyleHint, band: DestinationKnowledge['averageBudgetSar']): number {
  if (style === 'weekend') return Math.round(band.low * 0.85)
  if (style === 'family') return Math.round(mid * 1.15)
  if (style === 'business' || style === 'honeymoon') return Math.round(band.high * 0.9)
  return mid
}

export function resolveKnowledgeKey(
  destination?: string | null,
  specialRequests?: string | null,
): string | null {
  const preferred = specialRequests?.match(/preferredCity=([^\s|;]+)/i)?.[1]
  if (preferred) {
    const cityKey = resolveDestinationKnowledgeKey(preferred)
    if (cityKey) return cityKey
  }
  return resolveDestinationKnowledgeKey(destination)
}

export function reasonFromDestinationKnowledge(input: {
  destination?: string | null
  specialRequests?: string | null
  adults?: number | null
  children?: number | null
  durationDays?: number | null
}): DestinationReasoning | null {
  const key = resolveKnowledgeKey(input.destination, input.specialRequests)
  if (!key) return null
  const knowledge = getDestinationKnowledgeByKey(key)
  if (!knowledge) return null

  const taggedDuration = readTaggedDuration(input.specialRequests)
  const style = inferTripStyle({
    durationDays: input.durationDays ?? taggedDuration,
    specialRequests: input.specialRequests,
    adults: input.adults,
    children: input.children,
  })

  const ranked = rankCities(knowledge, style)
  const contrast = buildCityContrast(ranked)
  const durationDays = taggedDuration ?? knowledge.tripDuration.recommended
  const itinerary = buildItinerary(ranked, durationDays)
  const styleNote = buildStyleNote(knowledge, style, ranked)
  const airports = airportSummary(knowledge)
  const explainability = buildExplainableRecommendation({
    knowledge,
    ranked,
    tripStyle: style,
    specialRequests: input.specialRequests,
    adults: input.adults,
    children: input.children,
    durationDays: taggedDuration ?? input.durationDays,
  })

  return {
    knowledge,
    tripStyle: style,
    rankedCities: ranked,
    cityContrastEn: contrast.en,
    cityContrastAr: contrast.ar,
    recommendedCityNamesEn: ranked.map((r) => r.city.nameEn),
    recommendedCityNamesAr: ranked.map((r) => r.city.nameAr),
    itinerarySketchEn: itinerary.en,
    itinerarySketchAr: itinerary.ar,
    styleNoteEn: styleNote.en,
    styleNoteAr: styleNote.ar,
    seasonEn: knowledge.bestSeason.en,
    seasonAr: knowledge.bestSeason.ar,
    climateEn: knowledge.climate.en,
    climateAr: knowledge.climate.ar,
    duration: knowledge.tripDuration,
    budgetSar: knowledge.averageBudgetSar,
    adjustedBudgetMid: adjustBudget(knowledge.averageBudgetSar.mid, style, knowledge.averageBudgetSar),
    flightEn: knowledge.flightFromKsa.en,
    flightAr: knowledge.flightFromKsa.ar,
    timezoneEn: knowledge.timezone.en,
    timezoneAr: knowledge.timezone.ar,
    visaEn: knowledge.visaNotes.en,
    visaAr: knowledge.visaNotes.ar,
    transportEn: knowledge.transportation.en,
    transportAr: knowledge.transportation.ar,
    airportSummaryEn: airports.en,
    airportSummaryAr: airports.ar,
    attractionsEn: knowledge.attractionsEn,
    attractionsAr: knowledge.attractionsAr,
    scores: {
      family: knowledge.familyScore,
      honeymoon: knowledge.honeymoonScore,
      business: knowledge.businessScore,
      beaches: knowledge.beaches,
      mountains: knowledge.mountains,
      nightlife: knowledge.nightlife,
      shopping: knowledge.shopping,
      culture: knowledge.culture,
    },
    explainability,
  }
}

export function buildDestinationReasoningLines(slots: TravelPlanSlots): string[] {
  const reasoning = reasonFromDestinationKnowledge({
    destination: slots.destination,
    specialRequests: slots.specialRequests,
    adults: slots.adults,
    children: slots.children,
    durationDays: readTaggedDuration(slots.specialRequests),
  })
  if (!reasoning) return []
  const x = reasoning.explainability
  return [
    `destination=${reasoning.knowledge.key}`,
    `country=${reasoning.knowledge.country}`,
    `season=${reasoning.seasonEn}`,
    `climate=${reasoning.climateEn}`,
    `flight=${reasoning.flightEn}`,
    `timezone=${reasoning.timezoneEn}`,
    `airports=${reasoning.airportSummaryEn}`,
    `visa=${reasoning.visaEn}`,
    `transport=${reasoning.transportEn}`,
    `duration=${reasoning.duration.recommended}d`,
    `budgetBandSar=${reasoning.budgetSar.low}-${reasoning.budgetSar.high}`,
    `style=${reasoning.tripStyle}`,
    `rankedCities=${reasoning.recommendedCityNamesEn.join('|')}`,
    `scores=family:${reasoning.scores.family},business:${reasoning.scores.business},beaches:${reasoning.scores.beaches},culture:${reasoning.scores.culture}`,
    `styleNote=${reasoning.styleNoteEn}`,
    `attractions=${reasoning.attractionsEn.slice(0, 3).join('|')}`,
    `explain.subject=${x.subjectNameEn}`,
    `explain.confidence=${x.confidence}`,
    `explain.rankingScore=${x.rankingScore}`,
    `explain.reasons=${x.explanationEn.join('|')}`,
    `explain.matched=${x.matchedPreferences.join('|')}`,
    `explain.unmatched=${x.unmatchedPreferences.join('|')}`,
    `explain.assumptions=${x.assumptions.join('|')}`,
    `explain.alternatives=${x.alternatives.map((a) => `${a.nameEn}:${a.reasonEn}`).join('|')}`,
  ]
}

export function indicativeBudgetForSlots(slots: TravelPlanSlots): {
  amount: number
  currency: 'SAR'
  noteAr: string
  noteEn: string
} | null {
  const reasoning = reasonFromDestinationKnowledge({
    destination: slots.destination,
    specialRequests: slots.specialRequests,
    adults: slots.adults,
    children: slots.children,
  })
  if (!reasoning) return null
  return {
    amount: reasoning.adjustedBudgetMid,
    currency: 'SAR',
    noteAr: 'تقدير إرشادي أولي — ليس عرض سعر حي.',
    noteEn: 'Preliminary indicative estimate — not a live quote.',
  }
}
