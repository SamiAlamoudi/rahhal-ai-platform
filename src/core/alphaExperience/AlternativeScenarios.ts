/**
 * Sprint 91 — alternative recommendation scenarios from existing package/decision labels.
 */

import type { DecisionEngineResult } from '../types'
import type { PackageBuilderResult, PackageCandidate } from '../packageBuilder'
import type { AlphaAlternativeScenario, AlphaScenarioKind } from './types'

const SCENARIO_DEFS: Array<{
  kind: AlphaScenarioKind
  label: string
  pick: (pkg: PackageBuilderResult | null, decision: DecisionEngineResult | null) => {
    packageId: string | null
    candidateId: string | null
    cost: number | null
    currency: string
    confidence: number
    explanationSeed: string
  }
}> = [
  {
    kind: 'best_value',
    label: 'Best Value',
    pick: (pkg, decision) => {
      const p = pkg?.labels.bestValue ?? pkg?.selected ?? null
      return fromPackage(p, decision, 'Best overall value across price and convenience.')
    },
  },
  {
    kind: 'cheapest',
    label: 'Cheapest',
    pick: (pkg, decision) => {
      const p = pkg?.labels.bestBudget
        ?? cheapestPackage(pkg)
        ?? null
      const c = decision?.recommendations.bestBudget ?? null
      return {
        packageId: p?.id ?? null,
        candidateId: c?.id ?? null,
        cost: p?.totalPrice ?? c?.totalPrice ?? null,
        currency: p?.currency ?? 'SAR',
        confidence: clampConf(p?.confidence ?? (c?.score?.confidence ?? 60) / 100),
        explanationSeed: 'Lowest total cost among viable options.',
      }
    },
  },
  {
    kind: 'luxury',
    label: 'Luxury',
    pick: (pkg, decision) => {
      const p = pkg?.labels.bestLuxury ?? luxuryPackage(pkg)
      return fromPackage(p, decision, 'Higher comfort, ratings, and premium services.')
    },
  },
  {
    kind: 'family',
    label: 'Family',
    pick: (pkg, decision) => {
      const p = pkg?.labels.bestFamily ?? familyPackage(pkg)
      return fromPackage(p, decision, 'Family-friendly lodging and softer transfer load.')
    },
  },
  {
    kind: 'business',
    label: 'Business',
    pick: (pkg, decision) => {
      const p = pkg?.labels.bestBusiness ?? businessPackage(pkg)
      const c = decision?.recommendations.bestComfort ?? null
      return {
        packageId: p?.id ?? null,
        candidateId: c?.id ?? null,
        cost: p?.totalPrice ?? c?.totalPrice ?? null,
        currency: p?.currency ?? 'SAR',
        confidence: clampConf(p?.confidence ?? (c?.score?.confidence ?? 65) / 100),
        explanationSeed: 'Reliable timing and comfort for productive travel.',
      }
    },
  },
  {
    kind: 'fastest',
    label: 'Fastest',
    pick: (pkg, decision) => {
      const c = decision?.recommendations.fastest ?? null
      const p = pkg?.ranked.find((x) => x.labels.some((l) => String(l).includes('fast'))) ?? null
      return {
        packageId: p?.id ?? null,
        candidateId: c?.id ?? null,
        cost: p?.totalPrice ?? c?.totalPrice ?? null,
        currency: p?.currency ?? 'SAR',
        confidence: clampConf(p?.confidence ?? (c?.score?.confidence ?? 65) / 100),
        explanationSeed: 'Shortest journey time with fewer interruptions.',
      }
    },
  },
  {
    kind: 'adventure',
    label: 'Adventure',
    pick: (pkg) => {
      const p = adventurePackage(pkg) ?? pkg?.labels.bestWeekend ?? pkg?.selected ?? null
      return fromPackage(p, null, 'More activities and flexible pacing for exploration.')
    },
  },
]

function clampConf(n: number): number {
  if (!Number.isFinite(n)) return 0.6
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, Math.min(1, n))
}

function cheapestPackage(pkg: PackageBuilderResult | null): PackageCandidate | null {
  if (!pkg?.ranked.length) return null
  return [...pkg.ranked].sort((a, b) => a.totalPrice - b.totalPrice)[0] ?? null
}

function luxuryPackage(pkg: PackageBuilderResult | null): PackageCandidate | null {
  return pkg?.ranked.find((p) =>
    p.labels.some((l) => String(l).includes('luxury')),
  ) ?? null
}

function familyPackage(pkg: PackageBuilderResult | null): PackageCandidate | null {
  return pkg?.ranked.find((p) =>
    p.labels.some((l) => String(l).includes('family')),
  ) ?? null
}

function businessPackage(pkg: PackageBuilderResult | null): PackageCandidate | null {
  return pkg?.ranked.find((p) =>
    p.labels.some((l) => String(l).includes('business')),
  ) ?? null
}

function adventurePackage(pkg: PackageBuilderResult | null): PackageCandidate | null {
  return pkg?.ranked.find((p) =>
    p.components.some((c) => c.kind === 'activity')
    || (p.reasons ?? []).some((r) => /adventure|activity|explore/i.test(r)),
  ) ?? null
}

function fromPackage(
  p: PackageCandidate | null,
  decision: DecisionEngineResult | null,
  seed: string,
): {
  packageId: string | null
  candidateId: string | null
  cost: number | null
  currency: string
  confidence: number
  explanationSeed: string
} {
  return {
    packageId: p?.id ?? null,
    candidateId: decision?.recommendations.bestOverall?.id ?? null,
    cost: p?.totalPrice ?? null,
    currency: p?.currency ?? 'SAR',
    confidence: clampConf(p?.confidence ?? 0.6),
    explanationSeed: p?.explanation?.split('\n')[0]?.trim() || seed,
  }
}

export function buildAlternativeScenarios(input: {
  packages: PackageBuilderResult | null
  decision: DecisionEngineResult | null
  primaryPackageId?: string | null
}): AlphaAlternativeScenario[] {
  const seen = new Set<string>()
  const out: AlphaAlternativeScenario[] = []

  for (const def of SCENARIO_DEFS) {
    const picked = def.pick(input.packages, input.decision)
    const key = `${def.kind}:${picked.packageId ?? ''}:${picked.candidateId ?? ''}`
    if (seen.has(key)) continue
    // Skip empty scenarios that duplicate the primary with no identity.
    if (!picked.packageId && !picked.candidateId) continue
    if (picked.packageId && picked.packageId === input.primaryPackageId && def.kind === 'best_value') {
      // Still include best_value as labeled scenario.
    }
    seen.add(key)
    out.push({
      kind: def.kind,
      label: def.label,
      estimatedCost: picked.cost,
      currency: picked.currency,
      confidence: picked.confidence,
      explanation: `${def.label}: ${picked.explanationSeed}`,
      packageId: picked.packageId,
      candidateId: picked.candidateId,
    })
  }

  return out
}
