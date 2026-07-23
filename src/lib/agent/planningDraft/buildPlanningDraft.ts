/**
 * Deterministic Planning Draft builder.
 * Rule-based estimates only — no providers, no LLM, no bookings.
 */

import type { AgentLocale, TripRequirements } from '../types'
import { allocateBudget } from '../budgetIntelligence/allocate'
import {
  CITY_ONLY_PRIORS,
  COUNTRY_CITY_PRIORS,
  fromSar,
  toSar,
  type CityCostPrior,
} from './cityCostPriors'
import type {
  CityBudgetFit,
  PlanningConfidence,
  PlanningDraft,
  PlanningDraftBreakdown,
  PlanningDraftCityOption,
} from './types'

export interface BuildPlanningDraftInput {
  requirements: TripRequirements
  locale?: AgentLocale
}

/** True when we have enough signal to estimate a useful planning draft. */
export function canBuildPlanningDraft(requirements: TripRequirements): boolean {
  const dest = requirements.destination || requirements.destinations[0]
  if (!dest) return false
  const hasBudget = requirements.budgetAmount != null || requirements.budgetFlexible === true
  const hasTiming = requirements.durationDays != null
    || Boolean(requirements.startDate)
    || Boolean(requirements.endDate)
  // Destination + (budget or timing) is enough to start estimating.
  return hasBudget || hasTiming
}

export function buildPlanningDraft(input: BuildPlanningDraftInput): PlanningDraft | null {
  const req = input.requirements
  const locale = input.locale ?? 'ar'
  if (!canBuildPlanningDraft(req)) return null

  const destination = req.destination || req.destinations[0] || ''
  const currency = (req.budgetCurrency || 'SAR').toUpperCase() === 'ر.س' ? 'SAR' : (req.budgetCurrency || 'SAR')
  const durationDays = resolveDurationDays(req)
  const travelers = Math.max(1, req.travelers ?? (req.travelerType === 'solo' ? 1 : 2))
  const monthHint = monthFromIso(req.startDate)
  const priors = resolveCityPriors(destination)
  const budgetAmount = req.budgetAmount
  const budgetFlexible = req.budgetFlexible === true
  const budgetSar = budgetAmount != null ? toSar(budgetAmount, currency) : null

  const nights = Math.max(1, durationDays - 1)
  const cityOptions = priors.map((prior) =>
    estimateCityOption({
      prior,
      locale,
      nights,
      durationDays,
      travelers,
      monthHint,
      budgetSar,
      currency,
      budgetFlexible,
    }),
  )

  // Rank: comfortable > balanced > tight > stretch; then lower estimated total.
  const fitRank: Record<CityBudgetFit, number> = {
    comfortable: 0,
    balanced: 1,
    tight: 2,
    stretch: 3,
  }
  const ranked = [...cityOptions].sort((a, b) => {
    const fitDelta = fitRank[a.fit] - fitRank[b.fit]
    if (fitDelta !== 0) return fitDelta
    return a.estimatedTotal - b.estimatedTotal
  })

  const primary = ranked[0]!
  const breakdown = buildPrimaryBreakdown({
    prior: priors.find((p) => p.nameEn === primary.name) ?? priors[0]!,
    nights,
    durationDays,
    travelers,
    monthHint,
    budgetSar,
    currency,
    budgetFlexible,
    style: req.budgetStyle,
  })

  const missingAssumptions = collectMissingAssumptions(req, durationDays, travelers)
  const confidence = scoreConfidence({
    req,
    durationDays,
    budgetAmount,
    cityCount: ranked.length,
    missingCount: missingAssumptions.length,
  })

  const tradeoffs = buildTradeoffs(ranked, locale, currency)
  const rankingNote = buildRankingNote({
    ranked,
    destination,
    budgetAmount,
    currency,
    locale,
    monthHint,
  })

  const dailySpendEstimate = Math.round(
    (breakdown.food + breakdown.transportation + breakdown.activities) / Math.max(1, durationDays),
  )

  return {
    kind: 'planning_draft',
    destination,
    cities: ranked,
    rankedCities: ranked.map((c) => c.name),
    recommendedDurationDays: durationDays,
    assumedTravelers: travelers,
    budgetAmount: budgetAmount ?? null,
    budgetCurrency: currency,
    budgetFlexible,
    breakdown,
    dailySpendEstimate,
    confidence: confidence.label,
    confidenceScore: confidence.score,
    missingAssumptions,
    tradeoffs,
    rankingNote,
    monthHint,
    generatedFor: {
      startDate: req.startDate ?? null,
      origin: req.origin ?? null,
    },
  }
}

/** Human lines for Travel Facts / local model — never raw JSON. */
export function planningDraftToInsightLines(draft: PlanningDraft, locale: AgentLocale = 'en'): string[] {
  const ar = locale === 'ar'
  const lines: string[] = []
  if (draft.rankingNote) lines.push(draft.rankingNote)
  const b = draft.breakdown
  lines.push(
    ar
      ? `تقدير أولي (~${draft.confidence}): طيران ≈${b.flights} · فنادق ≈${b.hotels} · طعام ≈${b.food} · تنقل ≈${b.transportation} · أنشطة ≈${b.activities} ${b.currency}`
      : `Rough split (~${draft.confidence} confidence): flights ≈${b.flights} · hotels ≈${b.hotels} · food ≈${b.food} · transport ≈${b.transportation} · activities ≈${b.activities} ${b.currency}`,
  )
  for (const t of draft.tradeoffs.slice(0, 2)) lines.push(t)
  if (draft.missingAssumptions[0]) {
    lines.push(
      ar
        ? `افتراض ناقص: ${draft.missingAssumptions[0]}`
        : `Open assumption: ${draft.missingAssumptions[0]}`,
    )
  }
  return lines
}

function resolveDurationDays(req: TripRequirements): number {
  if (req.durationDays != null && req.durationDays > 0) return Math.min(21, req.durationDays)
  if (req.startDate && req.endDate) {
    const start = Date.parse(req.startDate)
    const end = Date.parse(req.endDate)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.min(21, Math.max(1, Math.round((end - start) / 86_400_000) + 1))
    }
  }
  // Month-only / vague timing → consultant default week.
  if (req.startDate) return 7
  return 5
}

function monthFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null
  const m = Number(iso.slice(5, 7))
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function resolveCityPriors(destination: string): CityCostPrior[] {
  const key = normalizeKey(destination)
  if (COUNTRY_CITY_PRIORS[key]) return COUNTRY_CITY_PRIORS[key]!
  if (CITY_ONLY_PRIORS[key]) return [CITY_ONLY_PRIORS[key]!]
  // Fallback generic city prior derived from destination name.
  return [{
    nameEn: destination,
    nameAr: destination,
    flightHoursFromRiyadh: 6,
    hotelNightlySar: 450,
    dailyLocalSar: 220,
    relativeHotelCost: 'typical',
    style: ['city'],
    peakMonths: [7, 8, 12],
  }]
}

function peakMultiplier(prior: CityCostPrior, monthHint: number | null): number {
  if (monthHint == null) return 1
  return prior.peakMonths.includes(monthHint) ? 1.18 : 1
}

function estimateFlightSar(prior: CityCostPrior, travelers: number, monthHint: number | null): number {
  const base = Math.round(prior.flightHoursFromRiyadh * 180 * travelers)
  return Math.round(base * peakMultiplier(prior, monthHint))
}

function estimateCityOption(input: {
  prior: CityCostPrior
  locale: AgentLocale
  nights: number
  durationDays: number
  travelers: number
  monthHint: number | null
  budgetSar: number | null
  currency: string
  budgetFlexible: boolean
}): PlanningDraftCityOption {
  const { prior, locale, nights, durationDays, travelers, monthHint, budgetSar, currency, budgetFlexible } = input
  const peak = peakMultiplier(prior, monthHint)
  const flights = estimateFlightSar(prior, travelers, monthHint)
  const hotelNightly = Math.round(prior.hotelNightlySar * peak)
  // Assume 1 room per 2 travelers.
  const rooms = Math.max(1, Math.ceil(travelers / 2))
  const hotels = hotelNightly * nights * rooms
  const food = Math.round(prior.dailyLocalSar * 0.55 * durationDays * travelers * peak)
  const transportation = Math.round(prior.dailyLocalSar * 0.2 * durationDays * travelers)
  const activities = Math.round(prior.dailyLocalSar * 0.25 * durationDays * travelers)
  const estimatedTotalSar = flights + hotels + food + transportation + activities
  const estimatedTotal = fromSar(estimatedTotalSar, currency)
  const fit = classifyFit(estimatedTotalSar, budgetSar, budgetFlexible)
  const why = buildCityWhy(prior, fit, locale, monthHint)

  return {
    name: locale === 'ar' ? prior.nameAr : prior.nameEn,
    relativeHotelCost: prior.relativeHotelCost,
    fit,
    why,
    estimatedTotal,
    hotelNightly: fromSar(hotelNightly, currency),
    confidence: fit === 'stretch' ? 0.45 : fit === 'tight' ? 0.6 : fit === 'balanced' ? 0.75 : 0.85,
  }
}

function classifyFit(
  estimatedSar: number,
  budgetSar: number | null,
  budgetFlexible: boolean,
): CityBudgetFit {
  if (budgetSar == null || budgetFlexible) {
    return estimatedSar < 8000 ? 'comfortable' : estimatedSar < 14000 ? 'balanced' : 'tight'
  }
  const ratio = estimatedSar / Math.max(1, budgetSar)
  if (ratio <= 0.85) return 'comfortable'
  if (ratio <= 1.05) return 'balanced'
  if (ratio <= 1.25) return 'tight'
  return 'stretch'
}

function buildCityWhy(
  prior: CityCostPrior,
  fit: CityBudgetFit,
  locale: AgentLocale,
  monthHint: number | null,
): string {
  const ar = locale === 'ar'
  const peak = monthHint != null && prior.peakMonths.includes(monthHint)
  const styleBit = prior.style.includes('beach')
    ? (ar ? 'أجواء شاطئ واستجمام' : 'beach and slower days')
    : prior.style.includes('culture')
      ? (ar ? 'ثقافة وتجارب مدينة' : 'culture and city energy')
      : ''
  const hotelBit = prior.relativeHotelCost === 'lower'
    ? (ar ? 'تكلفة الفنادق عادةً أخف' : 'hotel prices are generally lower')
    : prior.relativeHotelCost === 'higher'
      ? (ar ? 'الفنادق أعلى نسبياً' : 'hotels run higher')
      : (ar ? 'تكلفة فنادق متوسطة' : 'hotel costs are mid-range')
  const fitBit = fit === 'comfortable'
    ? (ar ? 'يناسب الميزانية بارتياح' : 'fits the budget comfortably')
    : fit === 'balanced'
      ? (ar ? 'متوازن مع الميزانية' : 'balanced against the budget')
      : fit === 'tight'
        ? (ar ? 'يحتاج ضبطاً دقيقاً' : 'needs careful tuning')
        : prior.relativeHotelCost === 'lower'
          ? (ar ? 'الخيار الأكثر واقعية على هذا السقف' : 'the more realistic fit on this ceiling')
          : (ar ? 'قد يتجاوز السقف' : 'may exceed the ceiling')
  const peakBit = peak
    ? (ar ? 'مع ضغط موسمي في هذه الفترة' : 'with seasonal pressure in this window')
    : ''
  return [styleBit, hotelBit, fitBit, peakBit].filter(Boolean).join(ar ? ' — ' : ' — ')
}

function buildPrimaryBreakdown(input: {
  prior: CityCostPrior
  nights: number
  durationDays: number
  travelers: number
  monthHint: number | null
  budgetSar: number | null
  currency: string
  budgetFlexible: boolean
  style: TripRequirements['budgetStyle']
}): PlanningDraftBreakdown {
  const { prior, nights, durationDays, travelers, monthHint, budgetSar, currency, style } = input
  const peak = peakMultiplier(prior, monthHint)
  const rooms = Math.max(1, Math.ceil(travelers / 2))

  if (budgetSar != null && budgetSar > 0) {
    const allocation = allocateBudget({
      total: budgetSar,
      currency: 'SAR',
      style: style ?? 'midrange',
      nights,
    })
    // Split non-hotel/flight remainder into food / transport / activities (deterministic).
    const localPool = Math.max(0, budgetSar - allocation.flights - allocation.hotels)
    const food = Math.round(localPool * 0.5)
    const transportation = Math.round(localPool * 0.22)
    const activities = Math.max(0, localPool - food - transportation)
    return {
      flights: fromSar(allocation.flights, currency),
      hotels: fromSar(allocation.hotels, currency),
      food: fromSar(food, currency),
      transportation: fromSar(transportation, currency),
      activities: fromSar(activities, currency),
      currency,
      estimatedTotal: fromSar(budgetSar, currency),
    }
  }

  const flights = estimateFlightSar(prior, travelers, monthHint)
  const hotels = Math.round(prior.hotelNightlySar * peak) * nights * rooms
  const food = Math.round(prior.dailyLocalSar * 0.55 * durationDays * travelers * peak)
  const transportation = Math.round(prior.dailyLocalSar * 0.2 * durationDays * travelers)
  const activities = Math.round(prior.dailyLocalSar * 0.25 * durationDays * travelers)
  const estimatedTotalSar = flights + hotels + food + transportation + activities
  return {
    flights: fromSar(flights, currency),
    hotels: fromSar(hotels, currency),
    food: fromSar(food, currency),
    transportation: fromSar(transportation, currency),
    activities: fromSar(activities, currency),
    currency,
    estimatedTotal: fromSar(estimatedTotalSar, currency),
  }
}

function collectMissingAssumptions(
  req: TripRequirements,
  durationDays: number,
  travelers: number,
): string[] {
  const missing: string[] = []
  if (!req.origin) missing.push('exact departure city')
  if (req.durationDays == null) missing.push(`duration assumed as ${durationDays} days`)
  if (req.travelers == null && req.travelerType == null) {
    missing.push(`party size assumed as ${travelers}`)
  }
  if (req.budgetAmount == null && req.budgetFlexible !== true) {
    missing.push('budget ceiling not set')
  }
  if (!req.startDate && !req.endDate) missing.push('exact travel dates')
  return missing
}

function scoreConfidence(input: {
  req: TripRequirements
  durationDays: number
  budgetAmount: number | null | undefined
  cityCount: number
  missingCount: number
}): { label: PlanningConfidence; score: number } {
  let score = 0.35
  if (input.req.destination) score += 0.15
  if (input.budgetAmount != null) score += 0.2
  else if (input.req.budgetFlexible) score += 0.1
  if (input.req.durationDays != null) score += 0.15
  else if (input.req.startDate) score += 0.08
  if (input.req.origin) score += 0.08
  if (input.req.travelers != null) score += 0.05
  if (input.cityCount >= 2) score += 0.05
  score -= Math.min(0.2, input.missingCount * 0.04)
  score = Math.max(0.2, Math.min(0.92, score))
  const label: PlanningConfidence = score >= 0.72 ? 'high' : score >= 0.5 ? 'medium' : 'low'
  return { label, score: Math.round(score * 100) / 100 }
}

function buildTradeoffs(
  ranked: PlanningDraftCityOption[],
  locale: AgentLocale,
  currency: string,
): string[] {
  const ar = locale === 'ar'
  const out: string[] = []
  if (ranked.length >= 2) {
    const a = ranked[0]!
    const b = ranked[1]!
    out.push(
      ar
        ? `${a.name} أوفر على الإقامة تقريباً من ${b.name} (ليلة ≈${a.hotelNightly} مقابل ≈${b.hotelNightly} ${currency}).`
        : `${a.name} is generally lighter on stays than ${b.name} (nightly ≈${a.hotelNightly} vs ≈${b.hotelNightly} ${currency}).`,
    )
  }
  const stretch = ranked.find((c) => c.fit === 'stretch' || c.fit === 'tight')
  if (stretch && stretch !== ranked[0]) {
    out.push(
      ar
        ? `${stretch.name} أجمل لبعض التجارب لكنه أضيق على الميزانية.`
        : `${stretch.name} can feel richer for some experiences, but sits tighter on budget.`,
    )
  }
  return out
}

function buildRankingNote(input: {
  ranked: PlanningDraftCityOption[]
  destination: string
  budgetAmount: number | null | undefined
  currency: string
  locale: AgentLocale
  monthHint: number | null
}): string {
  const { ranked, destination, budgetAmount, currency, locale, monthHint } = input
  const ar = locale === 'ar'
  const top = ranked[0]
  const second = ranked[1]
  if (!top) {
    return ar ? `بدأت أقدّر رحلة ${destination}.` : `I have started estimating a ${destination} trip.`
  }
  const monthBit = monthHint === 8
    ? (ar ? 'في أغسطس' : 'in August')
    : monthHint != null
      ? (ar ? `في هذا الشهر` : 'in this travel window')
      : ''

  if (second && top.relativeHotelCost === 'lower' && budgetAmount != null) {
    return ar
      ? `مع ميزانية حوالي ${budgetAmount} ${currency}${monthBit ? ` ${monthBit}` : ''}، ${top.name} يناسب أفضل من ${second.name} لأن تكلفة الفنادق عادةً أقل.`
      : `With a budget around ${budgetAmount} ${currency}${monthBit ? ` ${monthBit}` : ''}, ${top.name} fits better than ${second.name} because hotel prices are generally lower.`
  }
  if (budgetAmount != null) {
    return ar
      ? `بناءً على تقدير أولي بميزانية ≈${budgetAmount} ${currency}، أميل لـ${top.name} كقاعدة أقوى للرحلة.`
      : `Based on a first-pass estimate around ${budgetAmount} ${currency}, I would lean toward ${top.name} as the stronger base.`
  }
  return ar
    ? `كتقدير أوّلي لـ${destination}، ${top.name} يبدو الاتجاه الأنسب للبداية.`
    : `As a first planning pass for ${destination}, ${top.name} looks like the strongest starting direction.`
}
