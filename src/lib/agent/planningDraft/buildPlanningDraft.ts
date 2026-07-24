/**
 * Deterministic Planning Draft builder.
 * Rule-based estimates only — no providers, no LLM, no bookings.
 *
 * Never invents travelerCount. Unknown scalars stay null and widen ranges.
 */

import type { AgentLocale, TripRequirements } from '../types'
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
  PlanningEstimate,
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
  return hasBudget || hasTiming
}

/**
 * Explicit traveler count only.
 * - travelers number → use it
 * - travelerType solo → 1, couple → 2 (type was extracted)
 * - family/friends/business/null without count → null
 */
export function resolveTravelerCount(req: TripRequirements): number | null {
  if (req.travelers != null && req.travelers > 0) return req.travelers
  if (req.travelerType === 'solo') return 1
  if (req.travelerType === 'couple') return 2
  return null
}

/** Explicit duration only — never invent 5/7 from a month hint. */
export function resolveDurationDays(req: TripRequirements): number | null {
  if (req.durationDays != null && req.durationDays > 0) {
    return Math.min(21, req.durationDays)
  }
  if (req.startDate && req.endDate) {
    const start = Date.parse(req.startDate)
    const end = Date.parse(req.endDate)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.min(21, Math.max(1, Math.round((end - start) / 86_400_000) + 1))
    }
  }
  return null
}

export function buildPlanningDraft(input: BuildPlanningDraftInput): PlanningDraft | null {
  const req = input.requirements
  const locale = input.locale ?? 'ar'
  if (!canBuildPlanningDraft(req)) return null

  const destination = req.destination || req.destinations[0] || ''
  const currency = normalizeCurrency(req.budgetCurrency)
  const durationDays = resolveDurationDays(req)
  const travelerCount = resolveTravelerCount(req)
  const monthHint = monthFromIso(req.startDate)
  const priors = resolveCityPriors(destination)
  const budgetAmount = req.budgetAmount ?? null
  const budgetFlexible = req.budgetFlexible === true
  const budgetSar = budgetAmount != null ? toSar(budgetAmount, currency) : null
  const originKnown = Boolean(req.origin)

  // Planning span used only for math — never reported as a known fact when null.
  const planningDays = durationDays ?? 7
  const nights = Math.max(1, planningDays - 1)
  const recommendedDurationDays = durationDays == null ? 7 : null

  const cityOptions = priors.map((prior) =>
    estimateCityOption({
      prior,
      locale,
      nights,
      planningDays,
      durationKnown: durationDays != null,
      travelerCount,
      monthHint,
      budgetSar,
      currency,
      budgetFlexible,
      originKnown,
    }),
  )

  const fitRank: Record<CityBudgetFit, number> = {
    comfortable: 0,
    balanced: 1,
    tight: 2,
    stretch: 3,
  }
  const ranked = [...cityOptions].sort((a, b) => {
    const fitDelta = fitRank[a.fit] - fitRank[b.fit]
    if (fitDelta !== 0) return fitDelta
    return a.estimatedTotal.mid - b.estimatedTotal.mid
  })

  const primaryPrior = priors.find((p) =>
    p.nameEn === ranked[0]?.name || p.nameAr === ranked[0]?.name,
  ) ?? priors[0]!

  const breakdown = buildBreakdown({
    prior: primaryPrior,
    nights,
    planningDays,
    durationKnown: durationDays != null,
    travelerCount,
    monthHint,
    budgetSar,
    currency,
    originKnown,
    locale,
  })

  const missingAssumptions = collectMissingAssumptions({
    req,
    durationDays,
    recommendedDurationDays,
    travelerCount,
  })

  const confidence = scoreConfidence({
    req,
    durationDays,
    travelerCount,
    budgetAmount,
    cityCount: ranked.length,
    missingCount: missingAssumptions.length,
  })

  const tradeoffs = buildTradeoffs(ranked, locale)
  const rankingNote = buildRankingNote({
    ranked,
    destination,
    budgetAmount,
    currency,
    locale,
    monthHint,
  })

  const dailySpendEstimate = buildDailySpendEstimate({
    breakdown,
    planningDays,
    durationKnown: durationDays != null,
    travelerCount,
    currency,
    locale,
  })

  return {
    kind: 'planning_draft',
    destination,
    cities: ranked,
    rankedCities: ranked.map((c) => c.name),
    durationDays,
    recommendedDurationDays,
    travelerCount,
    budgetAmount,
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
      ? `تقدير أولي (ثقة ${draft.confidence}): طيران ${fmtRange(b.flights)} · فنادق ${fmtRange(b.hotels)} · طعام ${fmtRange(b.food)} · تنقل ${fmtRange(b.transportation)} · أنشطة ${fmtRange(b.activities)}`
      : `First-pass ranges (${draft.confidence} confidence): flights ${fmtRange(b.flights)} · hotels ${fmtRange(b.hotels)} · food ${fmtRange(b.food)} · transport ${fmtRange(b.transportation)} · activities ${fmtRange(b.activities)}`,
  )
  lines.push(
    ar
      ? `طيران: ${fmtRange(b.flights)} — ${b.flights.reason}`
      : `Flights: ${fmtRange(b.flights)} — ${b.flights.reason}`,
  )
  lines.push(
    ar
      ? `فنادق: ${fmtRange(b.hotels)} — ${b.hotels.reason}`
      : `Hotels: ${fmtRange(b.hotels)} — ${b.hotels.reason}`,
  )
  for (const t of draft.tradeoffs.slice(0, 2)) lines.push(t)
  if (draft.travelerCount == null) {
    lines.push(ar ? 'عدد المسافرين غير محدد — التقديرات كمديات.' : 'Party size unknown — estimates shown as ranges.')
  }
  if (draft.missingAssumptions[0]) {
    lines.push(
      ar
        ? `معلومة ناقصة: ${draft.missingAssumptions[0]}`
        : `Missing: ${draft.missingAssumptions[0]}`,
    )
  }
  return lines
}

function fmtRange(est: PlanningEstimate): string {
  if (est.low === est.high) return `≈${est.mid} ${est.currency}`
  return `${est.low}–${est.high} ${est.currency}`
}

function normalizeCurrency(raw: string | null | undefined): string {
  if (!raw) return 'SAR'
  const c = raw.toUpperCase()
  if (c === 'ر.س' || c === 'ريال') return 'SAR'
  return c
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

function monthLabel(monthHint: number | null, locale: AgentLocale): string {
  if (monthHint === 8) return locale === 'ar' ? 'أغسطس' : 'August'
  if (monthHint == null) return locale === 'ar' ? 'موسم غير محدد' : 'an unspecified season'
  return locale === 'ar' ? 'هذه الفترة' : 'this travel window'
}

function makeEstimate(input: {
  low: number
  mid: number
  high: number
  currency: string
  confidence: PlanningConfidence
  reason: string
}): PlanningEstimate {
  const low = Math.max(0, Math.round(Math.min(input.low, input.mid, input.high)))
  const high = Math.max(0, Math.round(Math.max(input.low, input.mid, input.high)))
  const mid = Math.max(0, Math.round(input.mid))
  return {
    low,
    mid: Math.min(high, Math.max(low, mid)),
    high,
    currency: input.currency,
    confidence: input.confidence,
    reason: input.reason,
  }
}

function travelerBounds(travelerCount: number | null): { low: number; mid: number; high: number; known: boolean } {
  if (travelerCount != null && travelerCount > 0) {
    return { low: travelerCount, mid: travelerCount, high: travelerCount, known: true }
  }
  // Unknown party size — never invent a point count; bound the math as 1–2.
  return { low: 1, mid: 1, high: 2, known: false }
}

function estimateFlightSarForPax(
  prior: CityCostPrior,
  pax: number,
  monthHint: number | null,
  originKnown: boolean,
): { low: number; mid: number; high: number } {
  const peak = peakMultiplier(prior, monthHint)
  const mid = Math.round(prior.flightHoursFromRiyadh * 180 * pax * peak)
  // Unknown origin widens the band; known origin tightens around Riyadh-baseline prior.
  const spread = originKnown ? 0.12 : 0.22
  return {
    low: Math.round(mid * (1 - spread)),
    mid,
    high: Math.round(mid * (1 + spread)),
  }
}

function estimateCityOption(input: {
  prior: CityCostPrior
  locale: AgentLocale
  nights: number
  planningDays: number
  durationKnown: boolean
  travelerCount: number | null
  monthHint: number | null
  budgetSar: number | null
  currency: string
  budgetFlexible: boolean
  originKnown: boolean
}): PlanningDraftCityOption {
  const {
    prior, locale, nights, planningDays, durationKnown,
    travelerCount, monthHint, budgetSar, currency, budgetFlexible, originKnown,
  } = input
  const peak = peakMultiplier(prior, monthHint)
  const pax = travelerBounds(travelerCount)
  const month = monthLabel(monthHint, locale)

  const flightLow = estimateFlightSarForPax(prior, pax.low, monthHint, originKnown)
  const flightHigh = estimateFlightSarForPax(prior, pax.high, monthHint, originKnown)

  const nightlyMid = Math.round(prior.hotelNightlySar * peak)
  const nightlyLow = Math.round(nightlyMid * 0.85)
  const nightlyHigh = Math.round(nightlyMid * 1.2)
  // One room for up to 2 guests — stated in reason, not a hidden party invent.
  const roomsLow = 1
  const roomsHigh = pax.known ? Math.max(1, Math.ceil(pax.mid / 2)) : 1

  const hotelsLow = nightlyLow * nights * roomsLow
  const hotelsMid = nightlyMid * nights * roomsLow
  const hotelsHigh = nightlyHigh * nights * Math.max(roomsLow, roomsHigh)

  const foodLow = Math.round(prior.dailyLocalSar * 0.45 * planningDays * pax.low * peak)
  const foodMid = Math.round(prior.dailyLocalSar * 0.55 * planningDays * pax.mid * peak)
  const foodHigh = Math.round(prior.dailyLocalSar * 0.65 * planningDays * pax.high * peak)

  const transportLow = Math.round(prior.dailyLocalSar * 0.15 * planningDays * pax.low)
  const transportMid = Math.round(prior.dailyLocalSar * 0.2 * planningDays * pax.mid)
  const transportHigh = Math.round(prior.dailyLocalSar * 0.28 * planningDays * pax.high)

  const actLow = Math.round(prior.dailyLocalSar * 0.18 * planningDays * pax.low)
  const actMid = Math.round(prior.dailyLocalSar * 0.25 * planningDays * pax.mid)
  const actHigh = Math.round(prior.dailyLocalSar * 0.35 * planningDays * pax.high)

  const totalLow = flightLow.low + hotelsLow + foodLow + transportLow + actLow
  const totalMid = flightLow.mid + hotelsMid + foodMid + transportMid + actMid
  const totalHigh = flightHigh.high + hotelsHigh + foodHigh + transportHigh + actHigh

  const fit = classifyFit(totalMid, budgetSar, budgetFlexible)
  const why = buildCityWhy(prior, fit, locale, monthHint)

  const uncertaintyBits: string[] = []
  if (!originKnown) uncertaintyBits.push(locale === 'ar' ? 'مدينة المغادرة غير معروفة' : 'departure city unknown')
  if (!pax.known) uncertaintyBits.push(locale === 'ar' ? 'عدد المسافرين غير محدد' : 'party size unknown')
  if (!durationKnown) uncertaintyBits.push(locale === 'ar' ? 'المدة غير مثبتة' : 'duration not confirmed')
  const uncertainty = uncertaintyBits.length
    ? uncertaintyBits.join(locale === 'ar' ? '؛ ' : '; ')
    : (locale === 'ar' ? 'بناءً على المدخلات المتوفرة' : 'based on stated inputs')

  const conf: PlanningConfidence = (!pax.known || !originKnown || !durationKnown)
    ? 'low'
    : monthHint != null
      ? 'medium'
      : 'medium'

  return {
    name: locale === 'ar' ? prior.nameAr : prior.nameEn,
    relativeHotelCost: prior.relativeHotelCost,
    fit,
    why,
    estimatedTotal: makeEstimate({
      low: fromSar(totalLow, currency),
      mid: fromSar(totalMid, currency),
      high: fromSar(totalHigh, currency),
      currency,
      confidence: conf,
      reason: locale === 'ar'
        ? `تقدير إجمالي لـ${prior.nameAr} — ${uncertainty}`
        : `Total range for ${prior.nameEn} — ${uncertainty}`,
    }),
    hotelNightly: makeEstimate({
      low: fromSar(nightlyLow, currency),
      mid: fromSar(nightlyMid, currency),
      high: fromSar(nightlyHigh, currency),
      currency,
      confidence: monthHint != null ? 'medium' : 'low',
      reason: locale === 'ar'
        ? `متوسط تسعير ${month} لـ${prior.nameAr}`
        : `Average ${month} pricing for ${prior.nameEn}`,
    }),
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

function buildBreakdown(input: {
  prior: CityCostPrior
  nights: number
  planningDays: number
  durationKnown: boolean
  travelerCount: number | null
  monthHint: number | null
  budgetSar: number | null
  currency: string
  originKnown: boolean
  locale: AgentLocale
}): PlanningDraftBreakdown {
  const {
    prior, nights, planningDays, durationKnown, travelerCount,
    monthHint, currency, originKnown, locale,
  } = input
  const ar = locale === 'ar'
  const peak = peakMultiplier(prior, monthHint)
  const pax = travelerBounds(travelerCount)
  const month = monthLabel(monthHint, locale)
  const cityName = ar ? prior.nameAr : prior.nameEn

  const flightLow = estimateFlightSarForPax(prior, pax.low, monthHint, originKnown)
  const flightHigh = estimateFlightSarForPax(prior, pax.high, monthHint, originKnown)
  const flightReasonParts: string[] = []
  if (!originKnown) {
    flightReasonParts.push(ar ? 'مدينة المغادرة غير معروفة' : 'departure city unknown')
  } else {
    flightReasonParts.push(ar ? 'خط أساس من الرياض' : 'Riyadh-baseline route prior')
  }
  if (!pax.known) {
    flightReasonParts.push(ar ? 'عدد المسافرين غير محدد (مدى 1–2)' : 'party size unknown (range assumes 1–2)')
  } else {
    flightReasonParts.push(ar ? `لـ${pax.mid} مسافر` : `for ${pax.mid} traveler(s)`)
  }
  if (monthHint != null && prior.peakMonths.includes(monthHint)) {
    flightReasonParts.push(ar ? `ضغط موسمي في ${month}` : `seasonal pressure in ${month}`)
  }

  const flights = makeEstimate({
    low: fromSar(flightLow.low, currency),
    mid: fromSar(Math.round((flightLow.mid + flightHigh.mid) / 2), currency),
    high: fromSar(flightHigh.high, currency),
    currency,
    confidence: originKnown && pax.known ? 'medium' : 'low',
    reason: flightReasonParts.join(ar ? '؛ ' : '; '),
  })

  const nightlyMid = Math.round(prior.hotelNightlySar * peak)
  const hotels = makeEstimate({
    low: fromSar(Math.round(nightlyMid * 0.85) * nights, currency),
    mid: fromSar(nightlyMid * nights, currency),
    high: fromSar(Math.round(nightlyMid * 1.2) * nights * (pax.known && pax.mid > 2 ? Math.ceil(pax.mid / 2) : 1), currency),
    currency,
    confidence: durationKnown && monthHint != null ? 'medium' : 'low',
    reason: ar
      ? `متوسط تسعير ${month} لـ${cityName}${durationKnown ? '' : '؛ المدة غير مثبتة'}`
      : `Average ${month} pricing for ${cityName}${durationKnown ? '' : '; duration not confirmed'}`,
  })

  const food = makeEstimate({
    low: fromSar(Math.round(prior.dailyLocalSar * 0.45 * planningDays * pax.low * peak), currency),
    mid: fromSar(Math.round(prior.dailyLocalSar * 0.55 * planningDays * pax.mid * peak), currency),
    high: fromSar(Math.round(prior.dailyLocalSar * 0.65 * planningDays * pax.high * peak), currency),
    currency,
    confidence: pax.known && durationKnown ? 'medium' : 'low',
    reason: ar
      ? `إنفاق يومي محلي في ${cityName}${pax.known ? '' : '؛ عدد المسافرين غير محدد'}`
      : `Local daily spend in ${cityName}${pax.known ? '' : '; party size unknown'}`,
  })

  const transportation = makeEstimate({
    low: fromSar(Math.round(prior.dailyLocalSar * 0.15 * planningDays * pax.low), currency),
    mid: fromSar(Math.round(prior.dailyLocalSar * 0.2 * planningDays * pax.mid), currency),
    high: fromSar(Math.round(prior.dailyLocalSar * 0.28 * planningDays * pax.high), currency),
    currency,
    confidence: pax.known && durationKnown ? 'medium' : 'low',
    reason: ar
      ? `تنقل محلي تقديري${durationKnown ? '' : '؛ المدة غير مثبتة'}`
      : `Local transport estimate${durationKnown ? '' : '; duration not confirmed'}`,
  })

  const activities = makeEstimate({
    low: fromSar(Math.round(prior.dailyLocalSar * 0.18 * planningDays * pax.low), currency),
    mid: fromSar(Math.round(prior.dailyLocalSar * 0.25 * planningDays * pax.mid), currency),
    high: fromSar(Math.round(prior.dailyLocalSar * 0.35 * planningDays * pax.high), currency),
    currency,
    confidence: 'low',
    reason: ar
      ? `أنشطة اختيارية — تتغير حسب أسلوب الرحلة`
      : `Optional activities — varies with trip style`,
  })

  const estimatedTotal = makeEstimate({
    low: flights.low + hotels.low + food.low + transportation.low + activities.low,
    mid: flights.mid + hotels.mid + food.mid + transportation.mid + activities.mid,
    high: flights.high + hotels.high + food.high + transportation.high + activities.high,
    currency,
    confidence: confidenceMin(flights.confidence, hotels.confidence, food.confidence),
    reason: ar
      ? `مجموع المديات للفئات أعلاه`
      : `Sum of category ranges above`,
  })

  return { flights, hotels, food, transportation, activities, estimatedTotal }
}

function confidenceMin(...values: PlanningConfidence[]): PlanningConfidence {
  if (values.includes('low')) return 'low'
  if (values.includes('medium')) return 'medium'
  return 'high'
}

function buildDailySpendEstimate(input: {
  breakdown: PlanningDraftBreakdown
  planningDays: number
  durationKnown: boolean
  travelerCount: number | null
  currency: string
  locale: AgentLocale
}): PlanningEstimate {
  const { breakdown, planningDays, durationKnown, travelerCount, currency, locale } = input
  const ar = locale === 'ar'
  const localLow = breakdown.food.low + breakdown.transportation.low + breakdown.activities.low
  const localMid = breakdown.food.mid + breakdown.transportation.mid + breakdown.activities.mid
  const localHigh = breakdown.food.high + breakdown.transportation.high + breakdown.activities.high
  const days = Math.max(1, planningDays)
  return makeEstimate({
    low: Math.round(localLow / days),
    mid: Math.round(localMid / days),
    high: Math.round(localHigh / days),
    currency,
    confidence: durationKnown && travelerCount != null ? 'medium' : 'low',
    reason: ar
      ? `إنفاق يومي (طعام+تنقل+أنشطة)${durationKnown ? '' : '؛ المدة غير مثبتة'}${travelerCount == null ? '؛ عدد المسافرين غير محدد' : ''}`
      : `Daily local spend (food+transport+activities)${durationKnown ? '' : '; duration not confirmed'}${travelerCount == null ? '; party size unknown' : ''}`,
  })
}

function collectMissingAssumptions(input: {
  req: TripRequirements
  durationDays: number | null
  recommendedDurationDays: number | null
  travelerCount: number | null
}): string[] {
  const missing: string[] = []
  if (!input.req.origin) missing.push('exact departure city')
  if (input.travelerCount == null) missing.push('traveler count unknown')
  if (input.durationDays == null) {
    missing.push(
      input.recommendedDurationDays != null
        ? `duration unknown (planning span suggested as ${input.recommendedDurationDays} days for ranges only)`
        : 'duration unknown',
    )
  }
  if (input.req.budgetAmount == null && input.req.budgetFlexible !== true) {
    missing.push('budget ceiling not set')
  }
  if (!input.req.startDate && !input.req.endDate) missing.push('exact travel dates')
  return missing
}

function scoreConfidence(input: {
  req: TripRequirements
  durationDays: number | null
  travelerCount: number | null
  budgetAmount: number | null
  cityCount: number
  missingCount: number
}): { label: PlanningConfidence; score: number } {
  let score = 0.3
  if (input.req.destination) score += 0.15
  if (input.budgetAmount != null) score += 0.18
  else if (input.req.budgetFlexible) score += 0.08
  if (input.durationDays != null) score += 0.15
  else if (input.req.startDate) score += 0.06
  if (input.req.origin) score += 0.1
  if (input.travelerCount != null) score += 0.12
  else score -= 0.08
  if (input.cityCount >= 2) score += 0.04
  score -= Math.min(0.25, input.missingCount * 0.05)
  score = Math.max(0.15, Math.min(0.9, score))
  const label: PlanningConfidence = score >= 0.72 ? 'high' : score >= 0.48 ? 'medium' : 'low'
  return { label, score: Math.round(score * 100) / 100 }
}

function buildTradeoffs(
  ranked: PlanningDraftCityOption[],
  locale: AgentLocale,
): string[] {
  const ar = locale === 'ar'
  const out: string[] = []
  if (ranked.length >= 2) {
    const a = ranked[0]!
    const b = ranked[1]!
    out.push(
      ar
        ? `${a.name} أوفر على الإقامة تقريباً من ${b.name} (ليلة ${fmtRange(a.hotelNightly)} مقابل ${fmtRange(b.hotelNightly)}).`
        : `${a.name} is generally lighter on stays than ${b.name} (nightly ${fmtRange(a.hotelNightly)} vs ${fmtRange(b.hotelNightly)}).`,
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
  budgetAmount: number | null
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
      ? (ar ? 'في هذا الشهر' : 'in this travel window')
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
