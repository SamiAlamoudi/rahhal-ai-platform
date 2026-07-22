/**
 * Sprint 111 — RecommendationNarrator
 * Concise natural-language narration from structured concierge facts.
 */

import type {
  ConciergeExplanation,
  ConciergeNarrative,
  ConciergeRecommendationOption,
  ConciergeSavingsAnalysis,
  ConciergeTradeoff,
} from './types'

export function narrateRecommendation(input: {
  selected: ConciergeRecommendationOption | null
  explanation: ConciergeExplanation | null
  tradeoffs: ConciergeTradeoff[]
  savings: ConciergeSavingsAnalysis | null
  alternatives: ConciergeRecommendationOption[]
}): ConciergeNarrative {
  if (!input.selected) {
    return {
      primary: 'I do not have enough recommendation facts to narrate a selection.',
      alternatives: [],
      closing: null,
    }
  }

  const selected = input.selected
  const primary =
    input.explanation?.whySelected
    ?? `I selected ${selected.title ?? selected.id} as the best available option from the current recommendations.`

  const alternatives: string[] = []
  for (const t of input.tradeoffs.slice(0, 3)) {
    if (t.kind === 'cheaper_longer') {
      alternatives.push(
        `The second option (${t.againstTitle ?? t.againstOptionId}) is cheaper but includes a longer journey.`,
      )
    } else if (t.kind === 'expensive_better_timing') {
      alternatives.push(
        `A premium alternative (${t.againstTitle ?? t.againstOptionId}) costs more but improves timing.`,
      )
    } else if (t.kind === 'fewer_layovers') {
      alternatives.push(
        `Compared with ${t.againstTitle ?? t.againstOptionId}, the selected option has fewer layovers.`,
      )
    } else if (t.kind === 'better_hotel') {
      alternatives.push(
        `The selected option offers a better hotel than ${t.againstTitle ?? t.againstOptionId}.`,
      )
    } else if (t.alternativeAdvantage) {
      alternatives.push(
        `${t.againstTitle ?? t.againstOptionId}: ${t.alternativeAdvantage}.`,
      )
    } else {
      alternatives.push(t.summary)
    }
  }

  // Premium narration when a clearly higher-priced alt exists
  const premium = input.alternatives.find(
    (a) =>
      a.id !== selected.id
      && a.price != null
      && selected.price != null
      && a.price > selected.price * 1.25,
  )
  if (
    premium
    && !alternatives.some((line) => line.includes(premium.title ?? premium.id))
  ) {
    alternatives.push(
      `The premium option (${premium.title ?? premium.id}) costs more but significantly improves comfort.`,
    )
  }

  let closing: string | null = null
  if (
    input.savings?.potentialSavingsVsBudget != null
    && input.savings.potentialSavingsVsBudget > 0
  ) {
    closing =
      `This keeps ${input.savings.potentialSavingsVsBudget} ${input.savings.currency} under the stated budget.`
  } else if (input.explanation?.bestFor) {
    closing = `Best for: ${input.explanation.bestFor}.`
  }

  return { primary, alternatives, closing }
}

export class RecommendationNarrator {
  narrate(input: Parameters<typeof narrateRecommendation>[0]): ConciergeNarrative {
    return narrateRecommendation(input)
  }
}

export function createRecommendationNarrator(): RecommendationNarrator {
  return new RecommendationNarrator()
}
