/**
 * Sprint 106 — RecommendationReasoner
 * Explain selections using only provider / offer facts. Never invent facts.
 */

import type { ResponseComposerFlightFacts } from './types'

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m} minutes`
  if (m === 0) return `${h} hour${h === 1 ? '' : 's'}`
  return `${h}h ${m}m`
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount)}`
}

export interface ReasonerContext {
  selected: ResponseComposerFlightFacts
  pool: ResponseComposerFlightFacts[]
  kind: string
}

export function reasonAboutRecommendation(ctx: ReasonerContext): {
  reason: string
  reasons: string[]
  highlights: string[]
} {
  const { selected, pool, kind } = ctx
  const others = pool.filter((f) => f.id !== selected.id)
  const reasons: string[] = []
  const highlights: string[] = []
  const currency = selected.currency ?? 'SAR'

  const nonstops = pool.filter((f) => f.stops === 0)
  if (selected.stops === 0) {
    if (nonstops.length === 1) {
      reasons.push('Only nonstop option.')
      highlights.push('Nonstop')
    } else {
      reasons.push('Nonstop itinerary.')
      highlights.push('Nonstop')
    }
  }

  if (selected.price != null) {
    const pricedOthers = others.filter((f) => f.price != null)
    if (pricedOthers.length > 0) {
      const minOther = Math.min(...pricedOthers.map((f) => f.price!))
      const maxOther = Math.max(...pricedOthers.map((f) => f.price!))
      if (selected.price <= minOther) {
        reasons.push(`Lowest priced option at ${formatMoney(selected.price, currency)}.`)
        highlights.push('Lowest price')
      } else if (minOther - selected.price > 0) {
        // unreachable when selected.price <= minOther; keep savings vs average higher offers
      } else {
        const savingsVsMax = maxOther - selected.price
        if (savingsVsMax > 0 && (kind.includes('value') || kind.includes('overall'))) {
          reasons.push(
            `Costs ${formatMoney(selected.price, currency)}; saves ${formatMoney(savingsVsMax, currency)} versus the highest priced offer.`,
          )
        } else if (kind.includes('premium') || kind.includes('business')) {
          if (selected.price >= maxOther) {
            reasons.push(`Premium fare at ${formatMoney(selected.price, currency)}.`)
            highlights.push('Premium fare')
          }
        }
      }
    } else {
      reasons.push(`Priced at ${formatMoney(selected.price, currency)}.`)
    }
  }

  if (selected.durationMinutes != null) {
    const timedOthers = others.filter((f) => f.durationMinutes != null)
    if (timedOthers.length > 0) {
      const minDur = Math.min(...timedOthers.map((f) => f.durationMinutes!))
      const maxDur = Math.max(...timedOthers.map((f) => f.durationMinutes!))
      if (selected.durationMinutes <= minDur) {
        const saved = maxDur - selected.durationMinutes
        if (saved >= 60) {
          const hours = Math.max(1, Math.round(saved / 60))
          reasons.push(`Selected because it saves ${hours} hour${hours === 1 ? '' : 's'}.`)
          highlights.push(`Saves ~${hours}h`)
        } else if (saved > 0) {
          reasons.push(`Selected because it saves ${saved} minutes.`)
          highlights.push(`Saves ${saved}m`)
        } else {
          reasons.push(`Shortest duration (${formatDuration(selected.durationMinutes)}).`)
          highlights.push('Fastest')
        }
      }
    } else {
      reasons.push(`Flight duration ${formatDuration(selected.durationMinutes)}.`)
    }
  }

  const withBags = pool.filter((f) => f.baggageIncluded === true)
  const withoutBags = pool.filter((f) => f.baggageIncluded === false)
  if (selected.baggageIncluded === true && withoutBags.length > 0) {
    if (withBags.length === 1) {
      reasons.push('Lowest baggage restrictions.')
      highlights.push('Baggage included')
    } else {
      reasons.push('Baggage included.')
      highlights.push('Baggage included')
    }
  }

  if (selected.refundable === true) {
    reasons.push('Refundable fare.')
    highlights.push('Refundable')
  }

  if (selected.cabin) {
    reasons.push(`Cabin: ${selected.cabin.replace(/_/g, ' ')}.`)
    if (/business|first/i.test(selected.cabin)) {
      highlights.push(selected.cabin.replace(/_/g, ' '))
    }
  }

  if (selected.airline) {
    highlights.push(selected.airline)
  }

  // Balanced value signal when price and duration both present vs a cheaper-but-slower other
  if (
    (kind.includes('overall') || kind.includes('value'))
    && selected.price != null
    && selected.durationMinutes != null
  ) {
    const cheaperSlower = others.find(
      (f) =>
        f.price != null
        && f.durationMinutes != null
        && f.price < selected.price!
        && f.durationMinutes > selected.durationMinutes!,
    )
    const costlierFaster = others.find(
      (f) =>
        f.price != null
        && f.durationMinutes != null
        && f.price > selected.price!
        && f.durationMinutes < selected.durationMinutes!,
    )
    if (cheaperSlower || costlierFaster) {
      reasons.unshift('Best balance between price and duration.')
      highlights.unshift('Balanced value')
    }
  }

  const uniqueReasons = [...new Set(reasons.filter(Boolean))]
  const uniqueHighlights = [...new Set(highlights.filter(Boolean))]

  let reason = uniqueReasons[0] ?? 'Selected from available provider offers.'
  if (kind.includes('fast')) {
    reason =
      uniqueReasons.find((r) => /saves|Shortest|duration|faster/i.test(r))
      ?? reason
  } else if (kind.includes('overall') || kind.includes('value')) {
    reason =
      uniqueReasons.find((r) => /balance/i.test(r))
      ?? reason
  } else if (kind.includes('cheap')) {
    reason =
      uniqueReasons.find((r) => /Lowest priced|Saves|Priced/i.test(r))
      ?? reason
  }

  return {
    reason,
    reasons: uniqueReasons.length > 0 ? uniqueReasons : [reason],
    highlights: uniqueHighlights,
  }
}

export class RecommendationReasoner {
  explain(ctx: ReasonerContext) {
    return reasonAboutRecommendation(ctx)
  }
}

export function createRecommendationReasoner(): RecommendationReasoner {
  return new RecommendationReasoner()
}
