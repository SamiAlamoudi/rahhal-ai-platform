/**
 * Evolution Sprint 1 — ValueReasoner
 * Traveler value ≠ cheapest price.
 */

import { reasonAboutBudget } from './budgetReasoner'
import { buildTravelerProfile } from './travelerProfileBuilder'
import { reasonAboutRisk } from './riskReasoner'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type ValueReasonerResult,
} from './consultantTypes'

export function reasonAboutValue(input: ConsultantReasoningInput): ValueReasonerResult {
  const profile = buildTravelerProfile(input)
  const budget = reasonAboutBudget(input)
  const risk = reasonAboutRisk(input)

  const drivers: string[] = []
  const cheapnessCost: string[] = []

  drivers.push('Fit to stated/inferred trip purpose')
  drivers.push('Time and hassle (transfers, connections)')
  if (profile.profile.purpose === 'honeymoon' || profile.profile.pace === 'relaxed') {
    drivers.push('Atmosphere and recovery quality')
  }
  if (profile.profile.purpose === 'family') {
    drivers.push('Family logistics and pacing')
  }
  if (budget.budget.valueOverCheapest) {
    drivers.push('Value per day over minimum sticker price')
  }
  if (risk.risks.tolerance === 'low') {
    drivers.push('Operational reliability and clarity')
  }
  drivers.push('Cancellation / change flexibility (when offers exist later)')

  cheapnessCost.push('Worse location or longer transfers')
  cheapnessCost.push('Inconvenient timing or fatigue')
  if (profile.profile.purpose === 'honeymoon') {
    cheapnessCost.push('Loss of atmosphere that motivated the trip')
  }
  if (risk.risks.tolerance === 'low') {
    cheapnessCost.push('Higher logistics uncertainty')
  }

  const expectedValueSummary = budget.budget.valueOverCheapest
    ? 'Recommend the option that maximizes purpose-fit and reduces friction within budget — not the absolute cheapest.'
    : 'If cheapest is explicit, still disclose what is sacrificed in location, time, and flexibility.'

  const confidence = clamp01(0.55 + (budget.budget.stance !== 'unknown' ? 0.15 : 0) + 0.1)
  const missingInformation = [...budget.missingInformation]

  return {
    ...emptySlice({
      confidence,
      reasoning: [
        'Value framing is consultant-side and deterministic.',
        expectedValueSummary,
      ],
      tradeoffs: [
        'Paying more can buy time, safety margin, or atmosphere.',
        'Saving money can increase fatigue or reduce trip purpose fit.',
      ],
      assumptions: [
        'No live prices used — value drivers are qualitative until Decision Engine sees offers.',
      ],
      missingInformation,
      recommendationScore: clampScore(budget.budget.valueOverCheapest ? 78 : 58),
    }),
    value: {
      drivers,
      cheapnessCost,
      expectedValueSummary,
    },
  }
}

export const ValueReasoner = { reason: reasonAboutValue }
