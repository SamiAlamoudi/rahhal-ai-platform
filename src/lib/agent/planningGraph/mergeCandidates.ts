/**
 * Evolution Sprint 4 — MergeCandidates
 * Suggest which active plans can be merged.
 */

import { constraintConflicts } from './constraintPropagation'
import type { MergeCandidate, PlanNodeData } from './planningGraphTypes'

export function findMergeCandidates(nodes: PlanNodeData[]): MergeCandidate[] {
  const active = nodes.filter(
    (n) => n.status === 'active' || n.status === 'branched' || n.status === 'restored',
  )
  const out: MergeCandidate[] = []

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const left = active[i]!
      const right = active[j]!
      const conflicts = constraintConflicts(left, right)
      const reasons: string[] = []
      let compatibility = 70

      const samePurpose =
        left.travelerProfile.purpose
        && left.travelerProfile.purpose === right.travelerProfile.purpose
      if (samePurpose) {
        compatibility += 10
        reasons.push(`Shared purpose: ${left.travelerProfile.purpose}`)
      }

      const destOverlap = left.destinations.filter((d) =>
        right.destinations.map((x) => x.toLowerCase()).includes(d.toLowerCase()),
      )
      if (destOverlap.length) {
        compatibility += 12
        reasons.push(`Overlapping destinations: ${destOverlap.join(', ')}`)
      } else if (left.destinations.length && right.destinations.length) {
        compatibility -= 15
        reasons.push('Different locked destinations — merge needs traveler choice.')
      }

      if (
        typeof left.budget.amount === 'number'
        && typeof right.budget.amount === 'number'
        && Math.abs(left.budget.amount - right.budget.amount) / Math.max(left.budget.amount, 1) < 0.25
      ) {
        compatibility += 8
        reasons.push('Budgets are within 25%.')
      }

      compatibility -= conflicts.length * 20
      if (conflicts.length) reasons.push(...conflicts.map((c) => `Conflict: ${c}`))

      if (compatibility >= 45) {
        out.push({
          leftId: left.id,
          rightId: right.id,
          compatibility: Math.max(0, Math.min(100, compatibility)),
          reasons,
          conflicts,
        })
      }
    }
  }

  return out.sort((a, b) => b.compatibility - a.compatibility)
}

export const MergeCandidates = {
  find: findMergeCandidates,
}
