/**
 * Sprint 111 — TradeoffAnalyzer
 * Structured comparisons of the selected option vs alternatives (facts only).
 */

import type {
  ConciergeRecommendationOption,
  ConciergeTradeoff,
  ConciergeTradeoffKind,
} from './types'

function delta(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return null
  }
  return Math.round((a - b) * 100) / 100
}

function classify(
  selected: ConciergeRecommendationOption,
  other: ConciergeRecommendationOption,
): ConciergeTradeoffKind {
  const priceDelta = delta(selected.price, other.price)
  const durationDelta = delta(selected.durationMinutes, other.durationMinutes)
  const stopsDelta = delta(selected.stops, other.stops)
  const confDelta = delta(selected.confidence, other.confidence)
  const hotelDelta = delta(selected.hotelStars, other.hotelStars)

  if (priceDelta != null && priceDelta > 0 && durationDelta != null && durationDelta < 0) {
    return 'expensive_better_timing'
  }
  if (priceDelta != null && priceDelta < 0 && durationDelta != null && durationDelta > 0) {
    return 'cheaper_longer'
  }
  if (stopsDelta != null && stopsDelta < 0) return 'fewer_layovers'
  if (hotelDelta != null && hotelDelta > 0) return 'better_hotel'
  if (confDelta != null && confDelta > 0) return 'higher_confidence'
  if (priceDelta != null && priceDelta < 0) return 'cheaper'
  if (priceDelta != null && priceDelta > 0) return 'more_expensive'
  if (durationDelta != null && durationDelta < 0) return 'faster'
  if (durationDelta != null && durationDelta > 0) return 'longer'
  return 'other'
}

function labelFor(kind: ConciergeTradeoffKind): string {
  switch (kind) {
    case 'cheaper_longer':
      return 'Cheaper but longer'
    case 'expensive_better_timing':
      return 'More expensive but better timing'
    case 'fewer_layovers':
      return 'Fewer layovers'
    case 'better_hotel':
      return 'Better hotel'
    case 'higher_confidence':
      return 'Higher confidence'
    case 'cheaper':
      return 'Cheaper alternative'
    case 'faster':
      return 'Faster alternative'
    case 'more_expensive':
      return 'More expensive alternative'
    case 'longer':
      return 'Longer alternative'
    default:
      return 'Alternative comparison'
  }
}

export function analyzeTradeoffs(input: {
  selected: ConciergeRecommendationOption
  alternatives: ConciergeRecommendationOption[]
  max?: number
}): ConciergeTradeoff[] {
  const max = input.max ?? 5
  const others = input.alternatives.filter((a) => a.id !== input.selected.id)
  const out: ConciergeTradeoff[] = []

  for (const other of others.slice(0, max)) {
    const kind = classify(input.selected, other)
    const priceDelta = delta(input.selected.price, other.price)
    const durationDelta = delta(
      input.selected.durationMinutes,
      other.durationMinutes,
    )
    const stopsDelta = delta(input.selected.stops, other.stops)
    const confidenceDelta = delta(input.selected.confidence, other.confidence)

    const selectedBits: string[] = []
    const altBits: string[] = []

    if (priceDelta != null && priceDelta < 0) {
      selectedBits.push(`saves ${Math.abs(priceDelta)} ${input.selected.currency}`)
      altBits.push('higher price')
    } else if (priceDelta != null && priceDelta > 0) {
      selectedBits.push('higher price')
      altBits.push(`saves ${priceDelta} ${other.currency}`)
    }

    if (durationDelta != null && durationDelta < 0) {
      selectedBits.push(`${Math.abs(durationDelta)} min faster`)
      altBits.push('longer duration')
    } else if (durationDelta != null && durationDelta > 0) {
      selectedBits.push('longer duration')
      altBits.push(`${durationDelta} min faster`)
    }

    if (stopsDelta != null && stopsDelta < 0) {
      selectedBits.push('fewer layovers')
    } else if (stopsDelta != null && stopsDelta > 0) {
      altBits.push('fewer layovers')
    }

    if (
      input.selected.hotelStars != null
      && other.hotelStars != null
      && input.selected.hotelStars > other.hotelStars
    ) {
      selectedBits.push(`higher hotel rating (${input.selected.hotelStars}★)`)
    } else if (
      input.selected.hotelStars != null
      && other.hotelStars != null
      && other.hotelStars > input.selected.hotelStars
    ) {
      altBits.push(`higher hotel rating (${other.hotelStars}★)`)
    }

    if (confidenceDelta != null && confidenceDelta > 0) {
      selectedBits.push('higher confidence')
    } else if (confidenceDelta != null && confidenceDelta < 0) {
      altBits.push('higher confidence')
    }

    const summary =
      `Compared with ${other.title ?? other.id}: selected ${selectedBits.join(', ') || 'differs on available facts'}`
      + (altBits.length ? `; alternative offers ${altBits.join(', ')}` : '')
      + '.'

    out.push({
      kind,
      label: labelFor(kind),
      againstOptionId: other.id,
      againstTitle: other.title,
      summary,
      selectedAdvantage: selectedBits[0] ?? null,
      alternativeAdvantage: altBits[0] ?? null,
      priceDelta,
      durationDeltaMinutes: durationDelta,
      stopsDelta,
      confidenceDelta,
    })
  }

  return out
}

export class TradeoffAnalyzer {
  analyze(input: Parameters<typeof analyzeTradeoffs>[0]): ConciergeTradeoff[] {
    return analyzeTradeoffs(input)
  }
}

export function createTradeoffAnalyzer(): TradeoffAnalyzer {
  return new TradeoffAnalyzer()
}
