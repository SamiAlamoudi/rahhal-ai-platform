/**
 * Evolution Sprint 1 — TravelerProfileBuilder
 * Soft profile from text + known slots (deterministic).
 */

import { analyzeTravelerIntent } from './travelerIntentAnalyzer'
import {
  clamp01,
  clampScore,
  emptySlice,
  type BudgetStance,
  type ConsultantReasoningInput,
  type PacePreference,
  type RiskTolerance,
  type TravelerProfileResult,
} from './consultantTypes'

function paceFromText(text: string): PacePreference {
  if (/relax|slow|هادئ|استجمام|لا استعجل/i.test(text)) return 'relaxed'
  if (/packed|كثيف|كل يوم|busy itinerary|see everything/i.test(text)) return 'packed'
  if (/balanced|متوازن|moderate/i.test(text)) return 'balanced'
  return 'unknown'
}

function budgetStanceFromText(text: string, amount: number | null | undefined): BudgetStance {
  if (/luxury|5\s*star|فخم|خمس نجوم|first class/i.test(text)) return 'comfort_first'
  if (/cheap|أرخص|low cost|ميزانية ضيقة|tight budget/i.test(text)) return 'strict'
  if (/value|قيمة|worth|أفضل مقابل/i.test(text)) return 'value_seeking'
  if (/flexible budget|ميزانية مرنة|ok to stretch/i.test(text)) return 'flexible'
  if (typeof amount === 'number' && amount > 0) return 'value_seeking'
  return 'unknown'
}

function riskFromText(text: string): RiskTolerance {
  if (/safe|آمن|with kids|أطفال|elderly|avoid risk/i.test(text)) return 'low'
  if (/adventure|remote|مغامرة|off.?grid/i.test(text)) return 'high'
  return 'unknown'
}

function extractInterests(text: string, prior: string[] | undefined): string[] {
  const found = new Set<string>(prior ?? [])
  const map: Array<[RegExp, string]> = [
    [/beach|بحر|شاطئ/i, 'beach'],
    [/food|مطعم|cuisine|culinary/i, 'food'],
    [/nature|طبيعة|hike|جبل/i, 'nature'],
    [/city|مدينة|nightlife|تسوق|shopping/i, 'city'],
    [/history|متحف|culture|ثقافة/i, 'culture'],
    [/ski|ثلج|snow/i, 'winter_sports'],
  ]
  for (const [re, tag] of map) {
    if (re.test(text)) found.add(tag)
  }
  return [...found]
}

export function buildTravelerProfile(input: ConsultantReasoningInput): TravelerProfileResult {
  const intent = analyzeTravelerIntent(input)
  const text = input.userText ?? ''
  const adults = input.known?.adults ?? null
  const children = input.known?.children ?? null
  const partySize =
    adults != null || children != null
      ? (adults ?? 1) + (children ?? 0)
      : /\bfamily\b|عائلة|أطفال/i.test(text)
        ? null
        : /\bcouple\b|نحن اثنين|لشخصين/i.test(text)
          ? 2
          : null

  const pace = paceFromText(text)
  const budgetStance = budgetStanceFromText(text, input.known?.budgetAmount)
  const riskTolerance = riskFromText(text)
  const interests = extractInterests(text, input.known?.interests)
  const purpose = intent.purposeHint !== 'unknown'
    ? intent.purposeHint
    : (input.known?.tripPurpose as TravelerProfileResult['profile']['purpose']) || 'unknown'

  const styleNotes: string[] = []
  if (pace !== 'unknown') styleNotes.push(`pace:${pace}`)
  if (budgetStance !== 'unknown') styleNotes.push(`budget:${budgetStance}`)
  if (riskTolerance !== 'unknown') styleNotes.push(`risk:${riskTolerance}`)

  const missingInformation: string[] = []
  if (purpose === 'unknown') missingInformation.push('trip_purpose')
  if (partySize == null && intent.intent !== 'small_talk') missingInformation.push('party_size')
  if (budgetStance === 'unknown' && intent.intent !== 'small_talk') {
    missingInformation.push('budget_stance')
  }

  let confidence = 0.5 + (styleNotes.length * 0.08) + (interests.length * 0.05)
  if (purpose !== 'unknown') confidence += 0.1
  if (partySize != null) confidence += 0.08

  const reasoning = [
    'Built a soft traveler profile from wording and known slots only.',
    `Purpose=${purpose}; pace=${pace}; budgetStance=${budgetStance}; risk=${riskTolerance}.`,
  ]
  const tradeoffs = [
    'Soft profile guides recommendations but must not override hard constraints later.',
  ]
  const assumptions: string[] = []
  if (partySize == null) assumptions.push('Party size inferred as unknown — avoid over-planning capacity.')
  if (budgetStance === 'unknown') {
    assumptions.push('No budget stance yet — optimize for value, not cheapest.')
  }

  return {
    ...emptySlice({
      confidence: clamp01(confidence),
      reasoning,
      tradeoffs,
      assumptions,
      missingInformation,
      recommendationScore: clampScore(40 + confidence * 55),
    }),
    profile: {
      purpose: purpose === 'leisure' || purpose === 'honeymoon' || purpose === 'family'
        || purpose === 'business' || purpose === 'adventure' || purpose === 'recovery'
        || purpose === 'cultural'
        ? purpose
        : 'unknown',
      pace,
      budgetStance,
      riskTolerance,
      partySize,
      interests,
      styleNotes,
    },
  }
}

export const TravelerProfileBuilder = { build: buildTravelerProfile }
