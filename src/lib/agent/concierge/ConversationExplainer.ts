/**
 * Sprint 111 — ConversationExplainer
 * Facts-only explanations from Decision Engine / recommendation outputs.
 */

import type {
  ConciergeExplanation,
  ConciergeRecommendationOption,
  ConciergeTravelerPersona,
} from './types'

function personaBestFor(
  selected: ConciergeRecommendationOption,
  travelerType: ConciergeTravelerPersona | null | undefined,
): string {
  if (travelerType === 'family') {
    return 'Family travelers who want a balanced, reliable itinerary'
  }
  if (travelerType === 'business') {
    return 'Business travelers who value timing and fewer disruptions'
  }
  if (travelerType === 'luxury') {
    return 'Travelers prioritizing comfort and higher-end options'
  }
  if (travelerType === 'budget') {
    return 'Budget-conscious travelers focused on total cost'
  }

  const labels = selected.labels.map((l) => l.toLowerCase())
  const kind = (selected.kind ?? '').toLowerCase()
  if (kind.includes('business') || labels.some((l) => l.includes('business'))) {
    return 'Business travelers who value timing and cabin comfort'
  }
  if (kind.includes('family') || labels.some((l) => l.includes('family'))) {
    return 'Family travelers seeking a practical overall balance'
  }
  if (kind.includes('budget') || kind.includes('cheap')) {
    return 'Budget-conscious travelers'
  }
  if (kind.includes('luxury') || kind.includes('premium') || (selected.hotelStars ?? 0) >= 5) {
    return 'Travelers seeking a premium comfort-focused trip'
  }
  if (kind.includes('value')) {
    return 'Travelers who want strong value for money'
  }
  return 'Travelers seeking the best overall balance of price, time, and quality'
}

export function explainConversation(input: {
  selected: ConciergeRecommendationOption
  alternatives: ConciergeRecommendationOption[]
  decisionExplanation?: string | null
  decisionConfidence?: number | null
  travelerType?: ConciergeTravelerPersona | null
}): ConciergeExplanation {
  const { selected, alternatives } = input
  const strengths: string[] = []
  const weaknesses: string[] = []

  if (selected.reason?.trim()) {
    strengths.push(selected.reason.trim())
  }
  if (input.decisionExplanation?.trim()) {
    strengths.push(input.decisionExplanation.trim())
  }

  if (selected.stops === 0) {
    strengths.push('Nonstop flight')
  } else if (selected.stops != null && selected.stops > 0) {
    weaknesses.push(
      `${selected.stops} layover${selected.stops === 1 ? '' : 's'} on the selected flight`,
    )
  }

  if (selected.durationMinutes != null) {
    const faster = alternatives.find(
      (a) =>
        a.id !== selected.id
        && a.durationMinutes != null
        && selected.durationMinutes != null
        && a.durationMinutes < selected.durationMinutes,
    )
    if (faster) {
      weaknesses.push(
        `Longer total travel time than ${faster.title ?? faster.id}`,
      )
    } else {
      strengths.push('Competitive travel duration among available options')
    }
  }

  if (selected.price != null) {
    const cheaper = alternatives
      .filter((a) => a.id !== selected.id && a.price != null)
      .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0]
    if (cheaper && cheaper.price != null && selected.price > cheaper.price) {
      weaknesses.push(
        `Higher price than ${cheaper.title ?? cheaper.id} (${cheaper.price} ${cheaper.currency})`,
      )
    } else if (cheaper && cheaper.price != null && selected.price <= cheaper.price) {
      strengths.push('Lowest or joint-lowest price among compared options')
    } else {
      strengths.push(`Priced at ${selected.price} ${selected.currency}`)
    }
  }

  if (selected.hotelStars != null) {
    if (selected.hotelStars >= 4) {
      strengths.push(`${selected.hotelStars}★ hotel quality`)
    } else if (selected.hotelStars <= 2) {
      weaknesses.push(`Lower hotel star rating (${selected.hotelStars}★)`)
    }
  }

  if (selected.hotelName) {
    strengths.push(`Includes ${selected.hotelName}`)
  }

  if (selected.confidence != null) {
    if (selected.confidence >= 0.75) {
      strengths.push(`High option confidence (${Math.round(selected.confidence * 100)}%)`)
    } else if (selected.confidence < 0.5) {
      weaknesses.push(`Lower option confidence (${Math.round(selected.confidence * 100)}%)`)
    }
  } else if (input.decisionConfidence != null) {
    if (input.decisionConfidence >= 0.75) {
      strengths.push(
        `Decision confidence ${Math.round(input.decisionConfidence * 100)}%`,
      )
    } else if (input.decisionConfidence < 0.5) {
      weaknesses.push(
        `Decision confidence ${Math.round(input.decisionConfidence * 100)}%`,
      )
    }
  }

  if (strengths.length === 0) {
    strengths.push('Selected from available Decision Engine / composer recommendations')
  }

  const bestFor = personaBestFor(selected, input.travelerType)
  const whySelected =
    `I selected ${selected.title ?? selected.id} because it offers the best available balance`
    + (selected.price != null ? ` at ${selected.price} ${selected.currency}` : '')
    + (selected.durationMinutes != null
      ? ` with ${selected.durationMinutes} minutes of travel time`
      : '')
    + (selected.hotelName ? ` and stay at ${selected.hotelName}` : '')
    + '.'

  const reasoningSummary = [
    whySelected,
    strengths.slice(0, 3).join('; '),
    weaknesses.length > 0 ? `Watch-outs: ${weaknesses.slice(0, 2).join('; ')}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    whySelected,
    strengths,
    weaknesses,
    bestFor,
    reasoningSummary,
  }
}

export class ConversationExplainer {
  explain(input: Parameters<typeof explainConversation>[0]): ConciergeExplanation {
    return explainConversation(input)
  }
}

export function createConversationExplainer(): ConversationExplainer {
  return new ConversationExplainer()
}
