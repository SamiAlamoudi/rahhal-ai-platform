/**
 * Phase 3 Stage 5 — Trip summary presentation model (read-only).
 */

import { createExperienceCard } from './experienceCards'
import type {
  ExperienceCard,
  ExperienceComposerInput,
  ExperienceLocale,
  ExperienceTripSummaryModel,
} from './types'
import { clamp01, uniqueStrings } from './types'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

export interface ExperienceSourceFacts {
  locale: ExperienceLocale
  destination: string | null
  durationDays: number | null
  budgetAmount: number | null
  budgetCurrency: string | null
  adults: number | null
  children: number | null
  tripPurpose: string | null
  interests: string[]
  confidence: number
  missingInformation: string[]
  nextQuestions: string[]
  executiveLines: string[]
  alternatives: string[]
  alerts: string[]
}

export function extractExperienceSourceFacts(
  input: ExperienceComposerInput,
): ExperienceSourceFacts {
  const locale: ExperienceLocale = input.locale === 'en' ? 'en' : 'ar'
  const memory = asRecord(input.memoryContext)
  const req = asRecord(memory?.requirements) ?? memory
  const multi = asRecord(input.multiTurnSnapshot)
  const intel = asRecord(input.travelIntelligence)
  const proactive = asRecord(input.proactiveAdvisor)
  const unified = asRecord(input.consultantResponse)
  const body = asRecord(unified?.body)
  const plan = asRecord(input.tripPlan)

  const destination =
    str(req?.destination)
    ?? strList(req?.destinations)[0]
    ?? strList(plan?.destinations)[0]
    ?? extractDestination(input.userText)
    ?? (str(multi?.tripGoal)?.replace(/^trip:/i, '') ?? null)

  const missing = uniqueStrings([
    ...strList(multi?.missingInformation),
    ...strList(body?.missingInformation),
    ...strList(intel?.missingEvidence),
  ]).slice(0, 8)

  const nextQuestions = uniqueStrings([
    ...strList(body?.clarificationQuestions),
    ...(str(multi?.pendingClarification) ? [str(multi?.pendingClarification)!] : []),
  ]).slice(0, 3)

  const confidence = clamp01(
    num(intel?.overallConfidence)
      ?? num(body?.confidenceScore)
      ?? num(multi?.confidence)
      ?? (destination ? 0.55 : 0.3),
  )

  const ranked = Array.isArray(intel?.ranked) ? intel!.ranked : []
  const alternatives = ranked
    .map((r) => str(asRecord(r)?.destination))
    .filter((x): x is string => Boolean(x))
    .slice(0, 4)

  const proactiveRecs = Array.isArray(proactive?.recommendations)
    ? proactive!.recommendations
    : []
  const alerts = proactiveRecs
    .map((r) => str(asRecord(r)?.title) ?? str(asRecord(r)?.message))
    .filter((x): x is string => Boolean(x))
    .slice(0, 4)

  return {
    locale,
    destination,
    durationDays: num(req?.durationDays) ?? extractDays(input.userText),
    budgetAmount: num(req?.budgetAmount) ?? extractBudget(input.userText),
    budgetCurrency: str(req?.budgetCurrency) ?? 'SAR',
    adults: num(req?.travelers) ?? num(req?.adults),
    children: num(req?.children),
    tripPurpose: str(req?.tripPurpose),
    interests: strList(req?.interests),
    confidence,
    missingInformation: missing,
    nextQuestions,
    executiveLines: uniqueStrings([
      ...strList(body?.executiveSummary),
      ...strList(body?.primaryRecommendation),
      str(intel?.explanation) ?? '',
    ]).slice(0, 4),
    alternatives,
    alerts,
  }
}

export function buildExperienceTripSummary(
  facts: ExperienceSourceFacts,
): ExperienceTripSummaryModel {
  const ar = facts.locale === 'ar'
  const budgetLabel =
    facts.budgetAmount != null
      ? `${facts.budgetAmount} ${facts.budgetCurrency ?? 'SAR'}`
      : null
  const travelerLabel =
    facts.adults != null
      ? ar
        ? `${facts.adults} بالغ${facts.children ? ` · ${facts.children} طفل` : ''}`
        : `${facts.adults} adult${facts.adults === 1 ? '' : 's'}${
            facts.children ? ` · ${facts.children} child(ren)` : ''
          }`
      : null

  const headline = facts.destination
    ? ar
      ? `ملخص رحلة ${facts.destination}`
      : `${facts.destination} trip summary`
    : ar
      ? 'ملخص الرحلة'
      : 'Trip summary'

  return {
    headline,
    destination: facts.destination,
    durationDays: facts.durationDays,
    budgetLabel,
    travelerLabel,
    purpose: facts.tripPurpose,
    confidence: facts.confidence,
    missingInformation: [...facts.missingInformation],
    nextQuestions: [...facts.nextQuestions],
  }
}

export function buildExecutiveSummaryCard(
  facts: ExperienceSourceFacts,
): ExperienceCard | null {
  const ar = facts.locale === 'ar'
  const line =
    facts.executiveLines[0]
    ?? (facts.destination
      ? ar
        ? `نركّز حالياً على ${facts.destination}.`
        : `Current focus: ${facts.destination}.`
      : null)
  if (!line) return null
  return createExperienceCard({
    kind: 'executive_summary',
    title: ar ? 'الخلاصة التنفيذية' : 'Executive Summary',
    body: line,
    priority: 100,
    iconKey: 'executive',
    tags: ['summary'],
  })
}

function extractDestination(text: string): string | null {
  const map: Array<{ re: RegExp; name: string }> = [
    { re: /japan|اليابان/i, name: 'Japan' },
    { re: /bali|بالي/i, name: 'Bali' },
    { re: /paris|باريس/i, name: 'Paris' },
    { re: /dubai|دبي/i, name: 'Dubai' },
    { re: /london|لندن/i, name: 'London' },
    { re: /turkey|تركيا/i, name: 'Turkey' },
  ]
  for (const row of map) {
    if (row.re.test(text)) return row.name
  }
  return null
}

function extractBudget(text: string): number | null {
  const m =
    text.match(/(\d{3,7})\s*(sar|usd|eur|ريال)/i)
    ?? text.match(/(?:budget|ميزانية)\D{0,12}(\d{3,7})/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function extractDays(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*(?:days?|day|أيام|يوم|ليال[يى]|ليلة)/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : null
}

export const TripSummary = {
  extract: extractExperienceSourceFacts,
  build: buildExperienceTripSummary,
  executive: buildExecutiveSummaryCard,
}
