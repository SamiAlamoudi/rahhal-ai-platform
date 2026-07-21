/**
 * Sprint 84 — lightweight risk scoring for refined packages.
 */

import type { PackageCandidate } from '../packageBuilder/PackageCandidate'
import type { RefinementConflict } from './ConflictDetector'

export interface RefinementRisk {
  score: number
  level: 'low' | 'medium' | 'high'
  factors: string[]
}

export function analyzeRefinementRisk(
  pkg: PackageCandidate,
  conflicts: RefinementConflict[],
): RefinementRisk {
  let score = 0.1
  const factors: string[] = []

  const hard = conflicts.filter((c) => c.severity === 'hard')
  const soft = conflicts.filter((c) => c.severity === 'soft')
  score += hard.length * 0.18
  score += soft.length * 0.06
  if (hard.length) factors.push(`${hard.length} hard conflict(s)`)
  if (soft.length) factors.push(`${soft.length} soft conflict(s)`)

  const flight = pkg.components.find((c) => c.kind === 'flight')
  if (flight?.payload.stops && Number(flight.payload.stops) >= 2) {
    score += 0.1
    factors.push('multi-stop flight')
  }
  if (pkg.totalPrice > 15000) {
    score += 0.08
    factors.push('high package cost')
  }
  if (!pkg.components.some((c) => c.kind === 'transfer')) {
    score += 0.05
    factors.push('missing transfer')
  }

  score = Math.max(0, Math.min(1, score))
  const level = score >= 0.55 ? 'high' : score >= 0.3 ? 'medium' : 'low'
  return { score: Math.round(score * 100) / 100, level, factors }
}

export function refinementConfidence(
  pkg: PackageCandidate,
  conflicts: RefinementConflict[],
  incremental: boolean,
): number {
  let conf = incremental ? 0.72 : 0.55
  conf -= conflicts.filter((c) => c.severity === 'hard').length * 0.12
  conf -= conflicts.filter((c) => c.severity === 'soft').length * 0.04
  conf += Math.min(0.1, pkg.components.length * 0.01)
  if (pkg.providerConfidence > 0.8) conf += 0.05
  return Math.round(Math.max(0.15, Math.min(0.98, conf)) * 100) / 100
}
