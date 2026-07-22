/**
 * Sprint 93 — trip alternatives from ranked packages / decision hints.
 */

import type { TripAlternative, TripAlternativeKind, TripComposeRequest } from './types'

type Ranked = NonNullable<TripComposeRequest['packageRanked']>[number]

const DEFS: Array<{
  kind: TripAlternativeKind
  label: string
  pick: (ranked: Ranked[], decision: TripComposeRequest['decision']) => Ranked | null
  summary: (pkg: Ranked) => string
}> = [
  {
    kind: 'cheaper',
    label: 'Cheaper option',
    pick: (ranked, decision) => {
      if (decision?.bestBudgetId) {
        const hit = ranked.find((p) => p.id === decision.bestBudgetId)
        if (hit) return hit
      }
      const labeled = ranked.find((p) => p.labels?.some((l) => /budget|cheap|value/i.test(l)))
      if (labeled) return labeled
      return [...ranked].sort((a, b) => a.totalPrice - b.totalPrice)[0] ?? null
    },
    summary: (pkg) => `Lower total cost at ${pkg.totalPrice} ${pkg.currency}.`,
  },
  {
    kind: 'faster',
    label: 'Faster option',
    pick: (ranked, decision) => {
      if (decision?.fastestId) {
        const hit = ranked.find((p) => p.id === decision.fastestId)
        if (hit) return hit
      }
      return ranked.find((p) => p.labels?.some((l) => /fast/i.test(l))) ?? ranked[0] ?? null
    },
    summary: (pkg) => `Prioritizes shorter travel time — ${pkg.title}.`,
  },
  {
    kind: 'luxury',
    label: 'Luxury option',
    pick: (ranked, decision) => {
      if (decision?.bestComfortId) {
        const hit = ranked.find((p) => p.id === decision.bestComfortId)
        if (hit) return hit
      }
      return ranked.find((p) => p.labels?.some((l) => /luxury|premium|comfort/i.test(l)))
        ?? [...ranked].sort((a, b) => b.totalPrice - a.totalPrice)[0]
        ?? null
    },
    summary: (pkg) => `Higher comfort and amenities — ${pkg.title}.`,
  },
  {
    kind: 'balanced',
    label: 'Balanced option',
    pick: (ranked, decision) => {
      if (decision?.bestOverallId) {
        const hit = ranked.find((p) => p.id === decision.bestOverallId)
        if (hit) return hit
      }
      return ranked.find((p) => p.labels?.some((l) => /overall|balanced|value/i.test(l)))
        ?? ranked[0]
        ?? null
    },
    summary: (pkg) => `Best overall balance — ${pkg.title}.`,
  },
]

export function buildTripAlternatives(input: {
  primaryPackageId?: string | null
  ranked?: TripComposeRequest['packageRanked']
  decision?: TripComposeRequest['decision']
  currency: string
}): TripAlternative[] {
  const ranked = input.ranked ?? []
  const out: TripAlternative[] = []
  const seen = new Set<string>()

  for (const def of DEFS) {
    const pkg = def.pick(ranked, input.decision ?? null)
    if (!pkg) continue
    const key = `${def.kind}:${pkg.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      kind: def.kind,
      label: def.label,
      estimatedCost: pkg.totalPrice,
      currency: pkg.currency || input.currency,
      confidence: pkg.confidence,
      summary: def.summary(pkg),
      tripId: pkg.id,
    })
  }

  return out
}
