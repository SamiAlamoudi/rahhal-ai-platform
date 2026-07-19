/**
 * Concierge-style flight recommendation summary.
 * Uses consultant voice helpers — no hardcoded full sentences in the UI.
 */

import { emptyRequirements } from '../agent/types'
import type { AgentLocale } from '../agent/types'
import { buildConsultantReply } from '../concierge/consultantVoice'
import {
  advanceConciergeState,
  emptyConciergeState,
  emptySoftSignals,
} from '../concierge'
import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { TravelSearchRequest } from '../../utils/travelSearchRequest'
import { onlyFlights } from './viewModel'

export interface FlightRecommendationSummaryInput {
  options: NormalizedTravelOption[]
  searchRequest: TravelSearchRequest
  locale?: AgentLocale
}

export interface FlightRecommendationSummary {
  locale: AgentLocale
  totalFlights: number
  recommended: NormalizedTravelOption | null
  /** Full consultant paragraph for the results header. */
  summaryText: string
  rationale: string
}

function pickRecommended(flights: NormalizedTravelOption[]): NormalizedTravelOption | null {
  if (flights.length === 0) return null
  return [...flights].sort((a, b) => {
    const scoreDiff =
      (b.decisionScore?.weightedAverage ?? 0) - (a.decisionScore?.weightedAverage ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    const durationDiff =
      (a.durationMinutes ?? Number.POSITIVE_INFINITY)
      - (b.durationMinutes ?? Number.POSITIVE_INFINITY)
    if (durationDiff !== 0) return durationDiff
    return a.price - b.price
  })[0] ?? null
}

function buildRationale(
  locale: AgentLocale,
  recommended: NormalizedTravelOption,
  budget: number | null,
): string {
  const airline = String(recommended.attributes.airline ?? recommended.title)
  const duration = recommended.durationMinutes
  const nearBudget =
    budget != null && budget > 0
      ? recommended.price <= budget * 1.1
      : true

  if (locale === 'ar') {
    const timePart = duration != null
      ? 'أقصر زمن سفر عملي'
      : 'توازن جيد بين الراحة والسعر'
    const budgetPart = nearBudget ? 'مع البقاء قريباً من ميزانيتك' : 'مع قيمة واضحة مقابل السعر'
    return `أنصح بـ${airline} لأنه ${timePart} ${budgetPart}.`
  }

  const timePart = duration != null
    ? 'the shortest practical travel time'
    : 'a strong balance of comfort and value'
  const budgetPart = nearBudget
    ? 'while staying close to your preferred budget'
    : 'with clear value for the fare'
  return `My recommendation is ${airline} because it has ${timePart} ${budgetPart}.`
}

/**
 * Build a concierge summary above flight results.
 * Delegates copy scaffolding to `buildConsultantReply` (advise + option lines).
 */
export function buildFlightRecommendationSummary(
  input: FlightRecommendationSummaryInput,
): FlightRecommendationSummary {
  const locale = input.locale
    ?? (input.searchRequest.destination && /[\u0600-\u06FF]/.test(input.searchRequest.destination)
      ? 'ar'
      : 'en')
  const flights = onlyFlights(input.options)
  const recommended = pickRecommended(flights)
  const budget = input.searchRequest.budgetAmount || null

  if (!recommended) {
    const emptyDecision = {
      action: 'advise' as const,
      phase: 'advising' as const,
      state: advanceConciergeState({
        previous: emptyConciergeState(),
        phase: 'advising',
        lastAction: 'advise',
        softSignals: emptySoftSignals(),
        heardSummary: [],
      }),
      askFields: [],
      shouldExecuteAgent: false,
      rationale: 'empty-results',
    }
    const summaryText = buildConsultantReply({
      locale,
      decision: emptyDecision,
      requirements: emptyRequirements(),
      optionLines: [
        locale === 'ar'
          ? 'لم أجد رحلات تطابق هذا البحث الآن.'
          : 'I could not find flights matching this search right now.',
      ],
    })
    return {
      locale,
      totalFlights: 0,
      recommended: null,
      summaryText,
      rationale: locale === 'ar' ? 'لا توجد نتائج.' : 'No matching flights.',
    }
  }

  const rationale = buildRationale(locale, recommended, budget)
  const countLine = locale === 'ar'
    ? `وجدت ${flights.length} رحلة.`
    : `I found ${flights.length} flights.`

  const decision = {
    action: 'propose_options' as const,
    phase: 'advising' as const,
    state: advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'advising',
      lastAction: 'propose_options',
      softSignals: emptySoftSignals(),
      heardSummary: [
        String(recommended.attributes.origin ?? ''),
        String(recommended.attributes.destination ?? ''),
      ].filter(Boolean),
    }),
    askFields: [],
    shouldExecuteAgent: false,
    rationale: 'flight-results-summary',
  }

  const summaryText = buildConsultantReply({
    locale,
    decision,
    requirements: {
      ...emptyRequirements(),
      destination: input.searchRequest.destination || null,
      destinations: input.searchRequest.destination ? [input.searchRequest.destination] : [],
      budgetAmount: budget,
      budgetCurrency: input.searchRequest.budgetCurrency || null,
      travelers: input.searchRequest.travelers.total || null,
    },
    optionLines: [countLine, rationale],
  })

  return {
    locale,
    totalFlights: flights.length,
    recommended,
    summaryText,
    rationale,
  }
}
