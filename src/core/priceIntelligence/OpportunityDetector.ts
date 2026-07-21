/**
 * Sprint 81 — detect pricing opportunities / risks.
 */

import type { OpportunityKind, PriceAnalysisSnapshot } from './TimingRecommendation'
import { emitPriceEvent, type PriceEvent } from './events'

export function detectOpportunities(
  analysis: PriceAnalysisSnapshot,
  events?: PriceEvent[],
): OpportunityKind[] {
  const found: OpportunityKind[] = []

  const ratio = analysis.priceVsAverageRatio
  if (ratio != null && ratio <= 0.85) {
    found.push('exceptional_bargain')
  }
  if (ratio != null && ratio >= 1.25) {
    found.push('price_spike')
  }
  if (analysis.trend === 'rising' || (ratio != null && ratio >= 1.08 && analysis.demand === 'high')) {
    found.push('likely_increase')
  }
  if (
    analysis.trend === 'falling'
    || (ratio != null && ratio >= 1.1 && analysis.demand === 'low' && (analysis.daysToDeparture ?? 0) > 21)
  ) {
    found.push('likely_decrease')
  }
  if (analysis.volatility >= 0.2 || analysis.trend === 'volatile' || analysis.observationCount < 2) {
    found.push('high_uncertainty')
  }

  // Deduplicate preserving order
  const unique: OpportunityKind[] = []
  for (const kind of found) {
    if (!unique.includes(kind)) unique.push(kind)
  }

  for (const kind of unique) {
    emitPriceEvent('opportunity.detected', { kind, ratio, trend: analysis.trend }, events)
  }

  return unique
}
