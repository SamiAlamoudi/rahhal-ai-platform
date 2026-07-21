/**
 * Sprint 83 — dedupe, prune weak packages, keep highest quality.
 */

import type { PackageCandidate } from './PackageCandidate'
import { emitPackageEvent, type PackageEvent } from './events'

export function packageNormalizedKey(pkg: PackageCandidate): string {
  const ids = pkg.components
    .map((c) => `${c.kind}:${c.id}`)
    .sort()
    .join('|')
  return ids || pkg.id
}

export function dedupePackages(packages: PackageCandidate[]): {
  unique: PackageCandidate[]
  duplicateCount: number
} {
  const seen = new Map<string, PackageCandidate>()
  let duplicateCount = 0
  for (const pkg of packages) {
    const key = pkg.normalizedKey || packageNormalizedKey(pkg)
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, { ...pkg, normalizedKey: key })
      continue
    }
    duplicateCount += 1
    // Keep higher score / lower price
    const keep = (pkg.score ?? 0) > (existing.score ?? 0)
      || ((pkg.score ?? 0) === (existing.score ?? 0) && pkg.totalPrice < existing.totalPrice)
    if (keep) seen.set(key, { ...pkg, normalizedKey: key })
  }
  return { unique: [...seen.values()], duplicateCount }
}

/** Drop incompatible and bottom-quartile weak scores. */
export function pruneWeakPackages(
  packages: PackageCandidate[],
  options?: { keepTop?: number; minScore?: number; events?: PackageEvent[] },
): PackageCandidate[] {
  const keepTop = options?.keepTop ?? 24
  const minScore = options?.minScore ?? 35
  const compatible = packages.filter((p) => p.compatible)
  const filteredOut = packages.length - compatible.length
  if (filteredOut > 0) {
    emitPackageEvent('package.filtered', {
      reason: 'incompatible',
      count: filteredOut,
    }, options?.events)
  }

  const scored = compatible.filter((p) => (p.score ?? 0) >= minScore)
  const weak = compatible.length - scored.length
  if (weak > 0) {
    emitPackageEvent('package.filtered', {
      reason: 'weak_score',
      count: weak,
      minScore,
    }, options?.events)
  }

  const sorted = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.totalPrice - b.totalPrice)
  const kept = sorted.slice(0, keepTop)
  if (sorted.length > kept.length) {
    emitPackageEvent('package.filtered', {
      reason: 'prune_top',
      count: sorted.length - kept.length,
      keepTop,
    }, options?.events)
  }
  return kept
}

export async function optimizePackagesParallel(
  packages: PackageCandidate[],
  options?: { keepTop?: number; minScore?: number; events?: PackageEvent[] },
): Promise<{ packages: PackageCandidate[]; duplicateCount: number }> {
  // Async entrypoint for parallel pipeline composition with generate/score stages.
  const deduped = await Promise.resolve(dedupePackages(packages))
  const pruned = pruneWeakPackages(deduped.unique, options)
  return { packages: pruned, duplicateCount: deduped.duplicateCount }
}
