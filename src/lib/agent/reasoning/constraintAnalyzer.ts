/**
 * Evolution Sprint 1 — ConstraintAnalyzer
 */

import { buildTravelerProfile } from './travelerProfileBuilder'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type ConstraintAnalyzerResult,
} from './consultantTypes'

export function analyzeConstraints(input: ConsultantReasoningInput): ConstraintAnalyzerResult {
  const profile = buildTravelerProfile(input)
  const text = input.userText ?? ''
  const known = input.known ?? {}

  const hard: string[] = []
  const soft: string[] = []
  const flexibleDimensions: string[] = []

  if (known.destination) hard.push(`destination:${known.destination}`)
  if (typeof known.budgetAmount === 'number' && known.budgetAmount > 0) {
    if (profile.profile.budgetStance === 'strict' || /must|ضروري|ما أقدر أزيد/i.test(text)) {
      hard.push(`budget_cap:${known.budgetAmount}${known.budgetCurrency ? ` ${known.budgetCurrency}` : ''}`)
    } else {
      soft.push(`budget_target:${known.budgetAmount}`)
    }
  }
  if (typeof known.durationDays === 'number' && known.durationDays > 0) {
    hard.push(`duration_days:${known.durationDays}`)
  }
  if (typeof known.monthHint === 'number') soft.push(`month_preference:${known.monthHint}`)

  if (/must have|ضروري|لا أتنازل|non-?negotiable/i.test(text)) {
    soft.push('explicit_must_haves_present')
  }
  if (/flexible dates|تواريخ مرنة|dates? ok/i.test(text)) {
    flexibleDimensions.push('dates')
  }
  if (/any city|أي مدينة|open to destinations|مو محددة/i.test(text)) {
    flexibleDimensions.push('destination')
  }
  if (/hotel or apartment|فندق أو شقة/i.test(text)) {
    flexibleDimensions.push('lodging_type')
  }
  if (profile.profile.pace === 'relaxed') soft.push('prefer_relaxed_pace')
  if (profile.profile.riskTolerance === 'low') hard.push('low_risk_preference')

  if (hard.length === 0 && soft.length === 0) {
    soft.push('no_explicit_constraints_yet')
  }

  const missingInformation: string[] = []
  if (!known.destination && !flexibleDimensions.includes('destination')) {
    missingInformation.push('destination_or_flexibility')
  }
  if (!known.durationDays) missingInformation.push('duration')
  if (typeof known.budgetAmount !== 'number') missingInformation.push('budget_amount')

  const confidence = clamp01(0.4 + hard.length * 0.12 + soft.length * 0.06)
  const reasoning = [
    `Identified ${hard.length} hard and ${soft.length} soft constraints.`,
    flexibleDimensions.length
      ? `Flexible dimensions: ${flexibleDimensions.join(', ')}.`
      : 'No explicit flexibility declared.',
  ]

  return {
    ...emptySlice({
      confidence,
      reasoning,
      tradeoffs: [
        'Treating soft constraints as preferences — may yield to higher traveler value.',
        'Hard constraints block recommendations that violate them.',
      ],
      assumptions: [
        hard.includes('low_risk_preference')
          ? 'Low-risk preference treated as hard until traveler opts into adventure.'
          : 'Unstated constraints remain open rather than invented.',
      ],
      missingInformation,
      recommendationScore: clampScore(35 + confidence * 60),
    }),
    constraints: { hard, soft, flexibleDimensions },
  }
}

export const ConstraintAnalyzer = { analyze: analyzeConstraints }
