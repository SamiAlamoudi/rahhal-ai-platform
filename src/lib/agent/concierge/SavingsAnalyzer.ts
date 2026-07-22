/**
 * Sprint 111 — SavingsAnalyzer
 * Potential savings, price deltas, value notes — never fabricates numbers.
 */

import type {
  ConciergeRecommendationOption,
  ConciergeSavingsAnalysis,
} from './types'

export function analyzeSavings(input: {
  selected: ConciergeRecommendationOption | null
  recommendations: ConciergeRecommendationOption[]
  budget?: number | null
  currency?: string
}): ConciergeSavingsAnalysis {
  const currency =
    input.currency
    || input.selected?.currency
    || input.recommendations[0]?.currency
    || 'SAR'

  const priced = input.recommendations.filter(
    (o) => o.price != null && Number.isFinite(o.price),
  )
  const cheapest = [...priced].sort(
    (a, b) => (a.price ?? 0) - (b.price ?? 0),
  )[0] ?? null
  const premium = [...priced].sort(
    (a, b) => (b.price ?? 0) - (a.price ?? 0),
  )[0] ?? null

  const selectedPrice = input.selected?.price ?? null
  const cheapestPrice = cheapest?.price ?? null

  let potentialSavingsVsSelected: number | null = null
  if (
    selectedPrice != null
    && cheapestPrice != null
    && selectedPrice > cheapestPrice
  ) {
    potentialSavingsVsSelected =
      Math.round((selectedPrice - cheapestPrice) * 100) / 100
  } else if (selectedPrice != null && cheapestPrice != null) {
    potentialSavingsVsSelected = 0
  }

  let potentialSavingsVsBudget: number | null = null
  if (
    input.budget != null
    && Number.isFinite(input.budget)
    && selectedPrice != null
    && selectedPrice <= input.budget
  ) {
    potentialSavingsVsBudget =
      Math.round((input.budget - selectedPrice) * 100) / 100
  } else if (
    input.budget != null
    && selectedPrice != null
    && selectedPrice > input.budget
  ) {
    potentialSavingsVsBudget = 0
  }

  let priceDifferenceToPremium: number | null = null
  if (
    selectedPrice != null
    && premium?.price != null
    && premium.price > selectedPrice
  ) {
    priceDifferenceToPremium =
      Math.round((premium.price - selectedPrice) * 100) / 100
  } else if (selectedPrice != null && premium?.price != null) {
    priceDifferenceToPremium = 0
  }

  const valueImprovementNotes: string[] = []
  const confidenceImpactNotes: string[] = []

  if (
    input.selected
    && cheapest
    && input.selected.id !== cheapest.id
    && potentialSavingsVsSelected != null
    && potentialSavingsVsSelected > 0
  ) {
    valueImprovementNotes.push(
      `Choosing ${cheapest.title ?? cheapest.id} would reduce price by ${potentialSavingsVsSelected} ${currency}`,
    )
    if (
      input.selected.durationMinutes != null
      && cheapest.durationMinutes != null
      && cheapest.durationMinutes > input.selected.durationMinutes
    ) {
      valueImprovementNotes.push(
        `That cheaper option adds ${cheapest.durationMinutes - input.selected.durationMinutes} minutes of travel time`,
      )
    }
  }

  if (
    input.selected
    && premium
    && input.selected.id !== premium.id
    && priceDifferenceToPremium != null
    && priceDifferenceToPremium > 0
  ) {
    valueImprovementNotes.push(
      `Premium step-up to ${premium.title ?? premium.id} costs ${priceDifferenceToPremium} ${currency} more`,
    )
  }

  if (
    input.selected?.confidence != null
    && cheapest?.confidence != null
    && input.selected.id !== cheapest.id
  ) {
    const delta =
      Math.round((input.selected.confidence - cheapest.confidence) * 1000) / 1000
    if (delta > 0) {
      confidenceImpactNotes.push(
        `Selected option confidence is ${Math.round(delta * 100)} points higher than the cheapest option`,
      )
    } else if (delta < 0) {
      confidenceImpactNotes.push(
        `Cheapest option confidence is ${Math.round(Math.abs(delta) * 100)} points higher than the selected option`,
      )
    }
  }

  if (
    potentialSavingsVsBudget != null
    && potentialSavingsVsBudget > 0
    && input.budget != null
  ) {
    valueImprovementNotes.push(
      `Selected option leaves ${potentialSavingsVsBudget} ${currency} under the stated budget`,
    )
  }

  const summaryParts: string[] = []
  if (selectedPrice != null) {
    summaryParts.push(`Selected price ${selectedPrice} ${currency}`)
  }
  if (potentialSavingsVsSelected != null && potentialSavingsVsSelected > 0) {
    summaryParts.push(
      `up to ${potentialSavingsVsSelected} ${currency} cheaper alternatives exist`,
    )
  } else if (selectedPrice != null && cheapestPrice === selectedPrice) {
    summaryParts.push('already at the lowest available price in this set')
  }
  if (potentialSavingsVsBudget != null && potentialSavingsVsBudget > 0) {
    summaryParts.push(
      `${potentialSavingsVsBudget} ${currency} remaining vs budget`,
    )
  }

  return {
    selectedPrice,
    cheapestPrice,
    potentialSavingsVsSelected,
    potentialSavingsVsBudget,
    priceDifferenceToPremium,
    valueImprovementNotes,
    confidenceImpactNotes,
    currency,
    summary: summaryParts.join('; ') || 'Insufficient priced options for savings analysis',
  }
}

export class SavingsAnalyzer {
  analyze(input: Parameters<typeof analyzeSavings>[0]): ConciergeSavingsAnalysis {
    return analyzeSavings(input)
  }
}

export function createSavingsAnalyzer(): SavingsAnalyzer {
  return new SavingsAnalyzer()
}
