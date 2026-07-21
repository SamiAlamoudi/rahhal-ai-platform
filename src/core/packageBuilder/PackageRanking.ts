/**
 * Sprint 83 — package ranking labels.
 */

import type { PackageCandidate, PackageRankLabel } from './PackageCandidate'
import { emitPackageEvent, type PackageEvent } from './events'

function pick(
  list: PackageCandidate[],
  scoreOf: (p: PackageCandidate) => number,
): PackageCandidate | null {
  if (list.length === 0) return null
  return [...list].sort((a, b) => scoreOf(b) - scoreOf(a) || a.totalPrice - b.totalPrice)[0] ?? null
}

export function rankPackages(
  packages: PackageCandidate[],
  options?: { isWeekend?: boolean | null; events?: PackageEvent[] },
): {
  ranked: PackageCandidate[]
  labels: Record<string, PackageRankLabel[]>
} {
  const viable = packages.filter((p) => p.compatible)
  const ranked = [...viable].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.totalPrice - b.totalPrice)

  const bestOverall = pick(ranked, (p) => p.score ?? 0)
  const bestBudget = pick(ranked, (p) => {
    const cost = p.dimensions?.total_cost ?? 0
    return cost * 0.7 + (1000 / Math.max(1, p.totalPrice)) * 30
  })
  const bestBusiness = pick(ranked, (p) => p.dimensions?.business_suitability ?? 0)
  const bestFamily = pick(ranked, (p) => p.dimensions?.family_suitability ?? 0)
  const bestLuxury = pick(ranked, (p) => p.dimensions?.luxury_level ?? 0)
  const bestValue = pick(ranked, (p) => p.dimensions?.overall_value ?? 0)
  const bestWeekend = options?.isWeekend
    ? pick(ranked, (p) => {
      const walk = p.dimensions?.walking_distance ?? 0
      const value = p.dimensions?.overall_value ?? 0
      const time = p.dimensions?.travel_time ?? 0
      return walk * 0.3 + value * 0.4 + time * 0.3
    })
    : pick(ranked, (p) => (p.dimensions?.overall_value ?? 0) * 0.5 + (p.dimensions?.travel_time ?? 0) * 0.5)

  const labelMap = new Map<string, PackageRankLabel[]>()
  const add = (pkg: PackageCandidate | null, label: PackageRankLabel) => {
    if (!pkg) return
    const existing = labelMap.get(pkg.id) ?? []
    existing.push(label)
    labelMap.set(pkg.id, existing)
  }
  add(bestOverall, 'best_overall')
  add(bestBudget, 'best_budget')
  add(bestBusiness, 'best_business')
  add(bestFamily, 'best_family')
  add(bestLuxury, 'best_luxury')
  add(bestWeekend, 'best_weekend')
  add(bestValue, 'best_value')

  const withLabels = ranked.map((pkg) => ({
    ...pkg,
    labels: labelMap.get(pkg.id) ?? [],
  }))

  const labels: Record<string, PackageRankLabel[]> = {}
  for (const [id, list] of labelMap) labels[id] = list

  emitPackageEvent('package.ranked', {
    count: withLabels.length,
    bestOverallId: bestOverall?.id ?? null,
  }, options?.events)

  return { ranked: withLabels, labels }
}

export function pickLabeledPackages(ranked: PackageCandidate[]): {
  bestOverall: PackageCandidate | null
  bestBudget: PackageCandidate | null
  bestBusiness: PackageCandidate | null
  bestFamily: PackageCandidate | null
  bestLuxury: PackageCandidate | null
  bestWeekend: PackageCandidate | null
  bestValue: PackageCandidate | null
} {
  const find = (label: PackageRankLabel) => ranked.find((p) => p.labels.includes(label)) ?? null
  return {
    bestOverall: find('best_overall'),
    bestBudget: find('best_budget'),
    bestBusiness: find('best_business'),
    bestFamily: find('best_family'),
    bestLuxury: find('best_luxury'),
    bestWeekend: find('best_weekend'),
    bestValue: find('best_value'),
  }
}
