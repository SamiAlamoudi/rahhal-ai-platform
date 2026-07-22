/**
 * Sprint 93 — combine existing confidence signals (no new scoring engine).
 */

import type { TripConfidence } from './types'

function clamp01(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0.7
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, Math.min(1, n))
}

export function combineTripConfidence(input: {
  providerConfidence?: number | null
  priceConfidence?: number | null
  decisionConfidence?: number | null
  packageConfidence?: number | null
}): TripConfidence {
  const provider = clamp01(input.providerConfidence)
  const price = clamp01(input.priceConfidence)
  const decision = clamp01(input.decisionConfidence)
  const pkg = clamp01(input.packageConfidence)

  const overall = Math.round(
    ((provider * 0.25) + (price * 0.2) + (decision * 0.3) + (pkg * 0.25)) * 1000,
  ) / 1000

  const parts: string[] = []
  if (pkg >= 0.75) parts.push('Strong package signal')
  else parts.push('Moderate package signal')
  if (decision >= 0.75) parts.push('Decision engine is confident')
  else parts.push('Decision confidence is moderate')
  if (provider >= 0.75) parts.push('Provider data looks solid')
  else parts.push('Provider confidence is limited')
  if (price >= 0.7) parts.push('Price timing supports booking')
  else parts.push('Price timing is cautious')

  return {
    overall,
    provider,
    price,
    decision,
    package: pkg,
    reasoning: `${parts.join('. ')}.`,
  }
}
