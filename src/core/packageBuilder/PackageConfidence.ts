/**
 * Sprint 83 — package confidence 0.00–1.00.
 */

import type { PackageCandidate } from './PackageCandidate'

export function calculatePackageConfidence(pkg: PackageCandidate): number {
  if (!pkg.compatible) return 0.15

  let score = 0.35

  const kinds = new Set(pkg.components.map((c) => c.kind))
  // Completeness
  if (kinds.has('flight') && kinds.has('hotel')) score += 0.18
  if (kinds.has('transfer')) score += 0.06
  if (kinds.has('activity')) score += 0.05
  if (kinds.has('insurance') || kinds.has('esim') || kinds.has('lounge')) score += 0.04

  // Offer / provider quality
  const provider = Math.max(0, Math.min(1, pkg.providerConfidence))
  score += provider * 0.15

  // Score quality proxy
  if ((pkg.score ?? 0) >= 80) score += 0.1
  else if ((pkg.score ?? 0) >= 65) score += 0.06
  else if ((pkg.score ?? 0) >= 50) score += 0.03

  // Cancellation / price stability proxy
  const cancel = pkg.dimensions?.cancellation_flexibility ?? 0
  if (cancel >= 70) score += 0.06
  else if (cancel >= 40) score += 0.03

  // Traveler match proxies from dimensions
  const family = pkg.dimensions?.family_suitability ?? 0
  const business = pkg.dimensions?.business_suitability ?? 0
  const luxury = pkg.dimensions?.luxury_level ?? 0
  if (family >= 80 || business >= 80 || luxury >= 80) score += 0.05

  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100
}

export function attachConfidence(pkg: PackageCandidate): PackageCandidate {
  return { ...pkg, confidence: calculatePackageConfidence(pkg) }
}
