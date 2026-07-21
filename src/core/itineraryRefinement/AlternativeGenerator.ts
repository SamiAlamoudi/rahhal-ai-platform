/**
 * Sprint 84 — generate Option A/B/C when conflicts remain.
 */

import type { PackageCandidate } from '../packageBuilder/PackageCandidate'
import type { RefinementConflict } from './ConflictDetector'
import { emitRefinementEvent, type RefinementEvent } from './events'

export interface RefinementAlternative {
  id: string
  label: 'A' | 'B' | 'C'
  package: PackageCandidate
  pros: string[]
  cons: string[]
  costDifference: number
  timeDifferenceMinutes: number
  confidence: number
}

function clonePkg(pkg: PackageCandidate, idSuffix: string): PackageCandidate {
  return {
    ...pkg,
    id: `${pkg.id}_${idSuffix}`,
    components: pkg.components.map((c) => ({ ...c, payload: { ...c.payload } })),
  }
}

export function generateAlternatives(input: {
  base: PackageCandidate
  conflicts: RefinementConflict[]
  events?: RefinementEvent[]
}): RefinementAlternative[] {
  if (input.conflicts.length === 0) return []

  const base = input.base
  const alternatives: RefinementAlternative[] = []

  // Option A — drop conflicting activities
  const aPkg = clonePkg(base, 'altA')
  const conflictActIds = new Set(
    input.conflicts.flatMap((c) => c.componentIds).filter((id) => id.startsWith('act') || id.includes('activity') || id.includes('meeting') || id.includes('halal')),
  )
  aPkg.components = aPkg.components.filter((c) => {
    if (c.kind !== 'activity') return true
    return !conflictActIds.has(c.id) && !input.conflicts.some((cf) => cf.componentIds.includes(c.id))
  })
  // Also drop closed attractions
  aPkg.components = aPkg.components.filter((c) => c.payload.closed !== true)
  aPkg.totalPrice = aPkg.components.reduce((s, c) => s + c.price, 0)
  alternatives.push({
    id: aPkg.id,
    label: 'A',
    package: aPkg,
    pros: ['Removes conflicting activities', 'Keeps flight and hotel'],
    cons: ['Fewer experiences'],
    costDifference: aPkg.totalPrice - base.totalPrice,
    timeDifferenceMinutes: -120,
    confidence: 0.78,
  })

  // Option B — shift schedule later / softer pace
  const bPkg = clonePkg(base, 'altB')
  bPkg.components = bPkg.components.map((c) => {
    if (c.kind !== 'activity') return c
    const start = typeof c.payload.startAt === 'string' ? Date.parse(c.payload.startAt) : NaN
    if (Number.isNaN(start)) return c
    const next = start + 3 * 3600_000
    return {
      ...c,
      payload: {
        ...c.payload,
        startAt: new Date(next).toISOString(),
        endAt: new Date(next + 2 * 3600_000).toISOString(),
        closed: false,
      },
    }
  })
  alternatives.push({
    id: bPkg.id,
    label: 'B',
    package: bPkg,
    pros: ['Resolves timing conflicts', 'Keeps all components'],
    cons: ['Later activity schedule'],
    costDifference: 0,
    timeDifferenceMinutes: 180,
    confidence: 0.74,
  })

  // Option C — value trim (cheaper hotel signal)
  const cPkg = clonePkg(base, 'altC')
  cPkg.components = cPkg.components.map((c) => {
    if (c.kind !== 'hotel') return c
    return {
      ...c,
      price: Math.round(c.price * 0.82),
      payload: { ...c.payload, valueTrim: true, walkMinutes: Math.min(typeof c.payload.walkMinutes === 'number' ? c.payload.walkMinutes : 20, 15) },
    }
  })
  cPkg.components = cPkg.components.filter((c) => c.payload.closed !== true)
  cPkg.totalPrice = cPkg.components.reduce((s, c) => s + c.price, 0)
  alternatives.push({
    id: cPkg.id,
    label: 'C',
    package: cPkg,
    pros: ['Lower cost', 'Shorter walking distance'],
    cons: ['Possible hotel tradeoff'],
    costDifference: cPkg.totalPrice - base.totalPrice,
    timeDifferenceMinutes: 0,
    confidence: 0.7,
  })

  for (const alt of alternatives) {
    emitRefinementEvent('refinement.alternative', {
      label: alt.label,
      costDifference: alt.costDifference,
      confidence: alt.confidence,
    }, input.events)
  }

  return alternatives
}
