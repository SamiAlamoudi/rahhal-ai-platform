/**
 * Travel Reasoning Engine — infer destinations, budget fit, visa, timing.
 * Runs on the production agent path when `ai.travel_reasoning` is enabled.
 */

import type { TripRequirements } from '../types'
import { DESTINATION_CATALOG, findDestinationProfile } from './destinationCatalog'
import {
  climateFromPreference,
  detectOpenEndedDestination,
} from './openEndedDetector'
import type {
  ClimateBand,
  DestinationCandidate,
  DestinationClimateProfile,
  TravelReasoningInput,
  TravelReasoningResult,
  TravelReasoningSnapshot,
  VisaEase,
} from './types'

const COOL_FAMILY: ClimateBand[] = ['cool', 'cold']
const WARM_FAMILY: ClimateBand[] = ['warm', 'hot']

export function runTravelReasoning(input: TravelReasoningInput): TravelReasoningResult {
  const locale = input.locale
  const requirements = input.requirements
  const maxResults = input.maxResults ?? 3
  const now = input.now ?? new Date()
  const userText = input.userText ?? ''

  const named = requirements.destination || requirements.destinations[0] || null
  const open = detectOpenEndedDestination(userText, Boolean(named) && !requirements.destinationFlexible)
  const climate =
    climateFromPreference(requirements.weatherPreference)
    ?? open.climateHint
  const month = resolveTravelMonth(requirements, now)
  const durationDays = requirements.durationDays ?? inferDefaultDuration(requirements)
  const travelers = requirements.travelers ?? 2
  const budget = requirements.budgetAmount
  const currency = (requirements.budgetCurrency || 'SAR').toUpperCase()
  const budgetSar = toSar(budget, currency)

  const mode: TravelReasoningResult['mode'] =
    open.isOpenEnded || requirements.destinationFlexible
      ? 'open_ended'
      : named
        ? 'named'
        : 'open_ended'

  const scored = DESTINATION_CATALOG.map((profile) =>
    scoreDestination(profile, {
      locale,
      climate,
      month,
      durationDays,
      travelers,
      budgetSar,
      interests: requirements.interests,
      tripPurpose: requirements.tripPurpose,
      named,
    }),
  ).sort((a, b) => b.score - a.score)

  let primary: DestinationCandidate | null = null
  let alternatives: DestinationCandidate[] = []
  let rejected: DestinationCandidate[] = []

  if (mode === 'named' && named) {
    const profile = findDestinationProfile(named)
    const match = scored.find((row) =>
      row.id === profile?.id || row.name.toLowerCase() === named.toLowerCase(),
    )
    primary = match ?? buildFallbackNamed(named, locale, climate, month, budgetSar, durationDays, travelers)
    alternatives = scored.filter((row) => row.id !== primary?.id).slice(0, maxResults)
    rejected = scored.filter((row) => row.score < 0.35).slice(0, 3)
  } else {
    const accepted = scored.filter((row) => row.score >= 0.42)
    primary = accepted[0] ?? scored[0] ?? null
    alternatives = accepted.slice(1, maxResults)
    rejected = scored.filter((row) => row.score < 0.35).slice(0, 4)
  }

  const followUpFields = missingFollowUps(requirements)
  const rationale = buildRationale({
    locale,
    climate,
    month,
    budgetSar,
    primary,
    mode,
  })
  const overallConfidence = computeOverallConfidence(primary, alternatives, climate, month, budgetSar)
  const summary = buildSummary({ locale, primary, alternatives, climate, month, budgetSar })

  return {
    mode,
    locale,
    primary,
    alternatives,
    rejected,
    overallConfidence,
    summary,
    followUpFields,
    inferredMonth: month,
    inferredClimate: climate,
    rationale,
  }
}

export function toReasoningSnapshot(result: TravelReasoningResult): TravelReasoningSnapshot {
  const candidates = [
    result.primary,
    ...result.alternatives,
  ].filter((row): row is DestinationCandidate => Boolean(row))

  return {
    mode: result.mode,
    overallConfidence: result.overallConfidence,
    primaryId: result.primary?.id ?? null,
    candidateIds: candidates.map((row) => row.id),
    summary: result.summary,
    rationale: result.rationale,
    followUpFields: result.followUpFields as string[],
    inferredMonth: result.inferredMonth,
    inferredClimate: result.inferredClimate,
  }
}

export function applyReasoningToRequirements(
  requirements: TripRequirements,
  result: TravelReasoningResult,
): TripRequirements {
  const next: TripRequirements = {
    ...requirements,
    destinationFlexible: requirements.destinationFlexible ?? (result.mode === 'open_ended'),
  }

  if (result.inferredClimate && !next.weatherPreference) {
    next.weatherPreference = result.inferredClimate === 'cold' ? 'cool' : result.inferredClimate
  }

  const suggested = [
    result.primary,
    ...result.alternatives,
  ]
    .filter((row): row is DestinationCandidate => Boolean(row))
    .map((row) => row.name)

  if (suggested.length > 0) {
    next.destinations = uniqueStrings([...suggested, ...next.destinations])
  }

  // Keep destination unlocked until the traveler confirms a pick.
  if (result.mode === 'open_ended') {
    next.destination = null
  }

  return next
}

/** Detect confirmation of a previously proposed candidate. */
export function matchDestinationSelection(
  text: string,
  candidates: Array<{ id: string; name: string; nameAr: string }>,
): string | null {
  const lower = text.trim().toLowerCase()
  const ordinal = lower.match(/\b(?:option|choice|number|#)?\s*([1-3]|first|second|third)\b/)
    || text.match(/(?:الأولى|الاولى|الثانية|الثالثة|الخيار\s*[123]|رقم\s*[123])/)

  if (ordinal) {
    const token = (ordinal[1] || ordinal[0] || '').toString()
    const index =
      /first|1|أولى|اولى|الخيار\s*1|رقم\s*1/.test(token) ? 0
        : /second|2|ثانية|الخيار\s*2|رقم\s*2/.test(token) ? 1
          : /third|3|ثالثة|الخيار\s*3|رقم\s*3/.test(token) ? 2
            : -1
    if (index >= 0 && candidates[index]) return candidates[index].name
  }

  for (const row of candidates) {
    if (
      lower.includes(row.name.toLowerCase())
      || lower.includes(row.id)
      || text.includes(row.nameAr)
    ) {
      return row.name
    }
  }
  return null
}

function scoreDestination(
  profile: DestinationClimateProfile,
  ctx: {
    locale: TravelReasoningInput['locale']
    climate: ClimateBand | null
    month: number | null
    durationDays: number
    travelers: number
    budgetSar: number | null
    interests: string[]
    tripPurpose: TripRequirements['tripPurpose']
    named: string | null
  },
): DestinationCandidate {
  const monthIndex = ctx.month != null ? ctx.month - 1 : null
  const climateAtMonth = monthIndex != null ? profile.climateByMonth[monthIndex] : null
  let score = 0.45
  const whySelected: string[] = []
  const pros: string[] = []
  const cons: string[] = [...profile.risks.map(humanizeRisk)]
  const riskNotes = [...profile.risks]

  if (ctx.climate && climateAtMonth) {
    const match = climateMatches(ctx.climate, climateAtMonth)
    if (match === 'exact') {
      score += 0.28
      whySelected.push(ctx.locale === 'ar'
        ? `الطقس في هذا الوقت يناسب طلبك (${labelClimate(climateAtMonth, 'ar')})`
        : `Climate matches your preference (${labelClimate(climateAtMonth, 'en')})`)
      pros.push(ctx.locale === 'ar' ? 'طقس مناسب للموسم' : 'Seasonal climate fit')
    } else if (match === 'near') {
      score += 0.14
      whySelected.push(ctx.locale === 'ar'
        ? `قريب من طقسك المفضل (${labelClimate(climateAtMonth, 'ar')})`
        : `Close to your preferred climate (${labelClimate(climateAtMonth, 'en')})`)
    } else {
      score -= 0.22
      cons.push(ctx.locale === 'ar'
        ? `الطقس المتوقع ${labelClimate(climateAtMonth, 'ar')} — أبعد عن طلبك`
        : `Expected ${labelClimate(climateAtMonth, 'en')} — farther from your ask`)
    }
  } else if (ctx.climate) {
    // No month — use how often the climate appears across the year.
    const hits = profile.climateByMonth.filter((band) => climateMatches(ctx.climate!, band) !== 'miss').length
    score += Math.min(0.2, hits * 0.03)
  }

  const estimated = estimateTripCostSar(profile, ctx.durationDays, ctx.travelers)
  let budgetFit: DestinationCandidate['budgetFit'] = 'unknown'
  if (ctx.budgetSar != null && estimated != null) {
    const ratio = estimated / ctx.budgetSar
    if (ratio <= 0.75) {
      budgetFit = 'under'
      score += 0.12
      whySelected.push(ctx.locale === 'ar'
        ? `التكلفة التقديرية ≈ ${Math.round(estimated)} ر.س ضمن ميزانيتك`
        : `Estimated ≈ ${Math.round(estimated)} SAR — comfortably within budget`)
      pros.push(ctx.locale === 'ar' ? 'مريح ميزانياً' : 'Comfortable on budget')
    } else if (ratio <= 1.05) {
      budgetFit = 'fit'
      score += 0.18
      whySelected.push(ctx.locale === 'ar'
        ? `التكلفة التقديرية ≈ ${Math.round(estimated)} ر.س تناسب الميزانية`
        : `Estimated ≈ ${Math.round(estimated)} SAR fits the budget`)
      pros.push(ctx.locale === 'ar' ? 'ميزانية متوازنة' : 'Balanced budget fit')
    } else if (ratio <= 1.25) {
      budgetFit = 'tight'
      score += 0.02
      cons.push(ctx.locale === 'ar' ? 'قد تكون الميزانية ضيقة قليلاً' : 'Budget may be slightly tight')
    } else {
      budgetFit = 'over'
      score -= 0.25
      cons.push(ctx.locale === 'ar'
        ? `التكلفة التقديرية ≈ ${Math.round(estimated)} ر.س أعلى من الميزانية`
        : `Estimated ≈ ${Math.round(estimated)} SAR exceeds budget`)
    }
  }

  // Interest / purpose alignment
  for (const interest of ctx.interests) {
    if (profile.bestFor.includes(interest)) {
      score += 0.04
      whySelected.push(ctx.locale === 'ar' ? `مناسبة لاهتمام: ${interest}` : `Fits interest: ${interest}`)
    }
  }
  if (ctx.tripPurpose === 'honeymoon' && profile.bestFor.includes('romance')) score += 0.08
  if (ctx.tripPurpose === 'family' && profile.bestFor.includes('family')) score += 0.08
  if (ctx.tripPurpose === 'business' && profile.bestFor.includes('city')) score += 0.05

  // Prefer shorter flights when budget is constrained
  if (ctx.budgetSar != null && ctx.budgetSar <= 8000 && profile.flightHoursFromRiyadh <= 5) {
    score += 0.05
    pros.push(ctx.locale === 'ar' ? 'رحلة طيران أقصر من الرياض' : 'Shorter flight from Riyadh')
  }

  // Visa friction
  if (profile.visaFromSaudi === 'visa_free' || profile.visaFromSaudi === 'visa_on_arrival') {
    score += 0.06
    pros.push(visaLabel(profile.visaFromSaudi, ctx.locale))
  } else if (profile.visaFromSaudi === 'embassy') {
    score -= 0.04
    cons.push(ctx.locale === 'ar' ? 'تحتاج تأشيرة مسبقة' : 'Advance visa required')
  }

  if (ctx.named && profile.nameEn.toLowerCase() === ctx.named.toLowerCase()) {
    score += 0.35
  }

  score = clamp01(score)
  const confidence = clamp01(0.4 + score * 0.5)

  return {
    id: profile.id,
    name: profile.nameEn,
    nameAr: profile.nameAr,
    score,
    confidence,
    whySelected: whySelected.slice(0, 4),
    pros: unique(pros).slice(0, 4),
    cons: unique(cons).slice(0, 4),
    estimatedTripCostSar: estimated,
    budgetFit,
    climateMatch: climateAtMonth,
    visa: profile.visaFromSaudi,
    bestTimingNote: bestTimingNote(profile, ctx.climate, ctx.locale),
    riskNotes,
  }
}

function estimateTripCostSar(
  profile: DestinationClimateProfile,
  durationDays: number,
  travelers: number,
): number {
  const days = Math.max(2, durationDays)
  const adults = Math.max(1, travelers)
  // mid daily * days * adults + baseline flight share
  const flightShare = profile.flightHoursFromRiyadh * 180 * adults
  return Math.round(profile.dailyBudgetSar.mid * days * adults * 0.55 + flightShare)
}

function missingFollowUps(requirements: TripRequirements): Array<keyof TripRequirements> {
  const fields: Array<keyof TripRequirements> = []
  if (requirements.durationDays == null && !(requirements.startDate && requirements.endDate)) {
    fields.push('durationDays')
  }
  if (requirements.travelers == null) fields.push('travelers')
  if (requirements.travelerType == null) fields.push('travelerType')
  return fields
}

function resolveTravelMonth(requirements: TripRequirements, now: Date): number | null {
  const iso = requirements.startDate
  if (iso && /^\d{4}-\d{2}/.test(iso)) {
    return Number(iso.slice(5, 7))
  }
  return now.getUTCMonth() + 1
}

function inferDefaultDuration(requirements: TripRequirements): number {
  if (requirements.startDate && requirements.endDate) {
    const a = Date.parse(requirements.startDate)
    const b = Date.parse(requirements.endDate)
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
    }
  }
  return 5
}

function toSar(amount: number | null, currency: string): number | null {
  if (amount == null) return null
  const map: Record<string, number> = {
    SAR: 1,
    USD: 3.75,
    EUR: 4.1,
    GBP: 4.8,
    AED: 1.02,
  }
  return Math.round(amount * (map[currency] ?? 1))
}

function climateMatches(wanted: ClimateBand, actual: ClimateBand): 'exact' | 'near' | 'miss' {
  if (wanted === 'flexible') return 'near'
  if (wanted === actual) return 'exact'
  if (wanted === 'cool' && actual === 'cold') return 'near'
  if (wanted === 'cold' && actual === 'cool') return 'near'
  if (wanted === 'warm' && actual === 'hot') return 'near'
  if (wanted === 'hot' && actual === 'warm') return 'near'
  if (COOL_FAMILY.includes(wanted) && COOL_FAMILY.includes(actual)) return 'near'
  if (WARM_FAMILY.includes(wanted) && WARM_FAMILY.includes(actual)) return 'near'
  return 'miss'
}

function labelClimate(band: ClimateBand, locale: 'ar' | 'en'): string {
  const ar: Record<ClimateBand, string> = {
    cold: 'بارد',
    cool: 'مائل للبرودة',
    mild: 'معتدل',
    warm: 'دافئ',
    hot: 'حار',
    dry: 'جاف',
    rainy: 'ممطر',
    flexible: 'مرن',
  }
  return locale === 'ar' ? ar[band] : band
}

function visaLabel(visa: VisaEase, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    if (visa === 'visa_free') return 'بدون تأشيرة للسعوديين'
    if (visa === 'visa_on_arrival') return 'تأشيرة عند الوصول'
    if (visa === 'evisa') return 'تأشيرة إلكترونية سهلة'
    return 'تأشيرة مسبقة'
  }
  if (visa === 'visa_free') return 'Visa-free for Saudi passports'
  if (visa === 'visa_on_arrival') return 'Visa on arrival'
  if (visa === 'evisa') return 'Simple e-visa'
  return 'Advance visa needed'
}

function humanizeRisk(code: string): string {
  return code.replace(/_/g, ' ')
}

function bestTimingNote(
  profile: DestinationClimateProfile,
  climate: ClimateBand | null,
  locale: 'ar' | 'en',
): string | null {
  if (!climate || climate === 'flexible') return null
  const months = profile.climateByMonth
    .map((band, idx) => ({ band, month: idx + 1 }))
    .filter((row) => climateMatches(climate, row.band) !== 'miss')
    .map((row) => row.month)
  if (months.length === 0) return null
  const sample = months.slice(0, 3).join(', ')
  return locale === 'ar'
    ? `أشهر مناسبة تقريباً: ${sample}`
    : `Strong months roughly: ${sample}`
}

function buildFallbackNamed(
  named: string,
  locale: 'ar' | 'en',
  climate: ClimateBand | null,
  month: number | null,
  budgetSar: number | null,
  durationDays: number,
  travelers: number,
): DestinationCandidate {
  void month
  void climate
  const estimated = budgetSar != null
    ? Math.round(budgetSar * 0.85)
    : Math.round(600 * durationDays * Math.max(1, travelers) * 0.5)
  return {
    id: named.toLowerCase().replace(/\s+/g, '-'),
    name: named,
    nameAr: named,
    score: 0.7,
    confidence: 0.55,
    whySelected: [
      locale === 'ar' ? `وجهة محددة منك: ${named}` : `You named ${named}`,
    ],
    pros: [],
    cons: [],
    estimatedTripCostSar: estimated,
    budgetFit: budgetSar != null ? 'fit' : 'unknown',
    climateMatch: null,
    visa: 'unknown',
    bestTimingNote: null,
    riskNotes: [],
  }
}

function buildRationale(input: {
  locale: 'ar' | 'en'
  climate: ClimateBand | null
  month: number | null
  budgetSar: number | null
  primary: DestinationCandidate | null
  mode: TravelReasoningResult['mode']
}): string[] {
  const lines: string[] = []
  if (input.mode === 'open_ended') {
    lines.push(input.locale === 'ar'
      ? 'طلب مفتوح بدون وجهة ثابتة — استدلال على أفضل الخيارات'
      : 'Open-ended request — inferring best-fit destinations')
  }
  if (input.climate) {
    lines.push(input.locale === 'ar'
      ? `تفضيل الطقس: ${labelClimate(input.climate, 'ar')}`
      : `Climate preference: ${labelClimate(input.climate, 'en')}`)
  }
  if (input.month) {
    lines.push(input.locale === 'ar' ? `شهر السفر التقريبي: ${input.month}` : `Travel month ≈ ${input.month}`)
  }
  if (input.budgetSar != null) {
    lines.push(input.locale === 'ar'
      ? `ميزانية مرجعية ≈ ${input.budgetSar} ر.س`
      : `Budget baseline ≈ ${input.budgetSar} SAR`)
  }
  if (input.primary) {
    lines.push(input.locale === 'ar'
      ? `الترشيح الأول: ${input.primary.nameAr}`
      : `Top pick: ${input.primary.name}`)
  }
  return lines
}

function buildSummary(input: {
  locale: 'ar' | 'en'
  primary: DestinationCandidate | null
  alternatives: DestinationCandidate[]
  climate: ClimateBand | null
  month: number | null
  budgetSar: number | null
}): string {
  if (!input.primary) {
    return input.locale === 'ar'
      ? 'لم أجد وجهة واضحة بعد — أحتاج تفاصيل أكثر.'
      : 'No clear destination yet — I need a bit more detail.'
  }
  const alts = input.alternatives.map((row) => (input.locale === 'ar' ? row.nameAr : row.name)).join(
    input.locale === 'ar' ? '، ' : ', ',
  )
  if (input.locale === 'ar') {
    return alts
      ? `أقترح ${input.primary.nameAr} كخيار أول، مع بدائل: ${alts}.`
      : `أقترح ${input.primary.nameAr} بناءً على طلبك.`
  }
  return alts
    ? `I recommend ${input.primary.name} first, with alternatives: ${alts}.`
    : `I recommend ${input.primary.name} based on your ask.`
}

function computeOverallConfidence(
  primary: DestinationCandidate | null,
  alternatives: DestinationCandidate[],
  climate: ClimateBand | null,
  month: number | null,
  budgetSar: number | null,
): number {
  if (!primary) return 0.2
  let conf = primary.confidence
  if (alternatives.length >= 2) conf += 0.05
  if (climate) conf += 0.05
  if (month) conf += 0.05
  if (budgetSar != null) conf += 0.05
  return clamp01(conf)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function uniqueStrings(values: string[]): string[] {
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
