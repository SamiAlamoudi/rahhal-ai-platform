/**
 * Sprint 83 — lazy package explainability.
 */

import type { PackageCandidate } from './PackageCandidate'

function component(pkg: PackageCandidate, kind: string) {
  return pkg.components.find((c) => c.kind === kind)
}

/** Build explanation bullets; call lazily after ranking/selection. */
export function explainPackage(
  pkg: PackageCandidate,
  alternatives: PackageCandidate[] = [],
): PackageCandidate {
  const reasons: string[] = []
  const flight = component(pkg, 'flight')
  const hotel = component(pkg, 'hotel')
  const transfer = component(pkg, 'transfer')

  const cheaper = alternatives.find((a) => a.id !== pkg.id && a.totalPrice > pkg.totalPrice)
  if (cheaper) {
    const saved = Math.round(cheaper.totalPrice - pkg.totalPrice)
    if (saved > 0) reasons.push(`Saved ${pkg.currency} ${saved}`)
  } else if (alternatives.length > 0) {
    const max = Math.max(...alternatives.map((a) => a.totalPrice))
    const saved = Math.round(max - pkg.totalPrice)
    if (saved > 0) reasons.push(`Saved ${pkg.currency} ${saved}`)
  }

  if (flight && flight.payload.stops === 0) reasons.push('Direct flight')
  if (hotel && (typeof hotel.payload.rating === 'number' ? hotel.payload.rating >= 8.5 : false)) {
    reasons.push('Excellent hotel rating')
  }
  if (hotel?.payload.breakfastIncluded === true) reasons.push('Breakfast included')
  if (transfer) reasons.push('Airport transfer included')
  if (flight?.payload.refundable === true || hotel?.payload.refundable === true) {
    reasons.push('Flexible cancellation')
  }
  if (typeof hotel?.payload.walkMinutes === 'number' && hotel.payload.walkMinutes <= 15) {
    reasons.push('Walking distance to attractions')
  }
  if (hotel?.payload.familyFriendly === true) reasons.push('Family-friendly stay')
  if (hotel?.payload.luxury === true || (typeof hotel?.payload.stars === 'number' && hotel.payload.stars >= 5)) {
    reasons.push('Luxury hotel')
  }
  if (typeof flight?.payload.cabin === 'string' && /business|first/i.test(flight.payload.cabin)) {
    reasons.push('Business cabin')
  }

  if (reasons.length === 0) {
    reasons.push(`Highest package score (${pkg.score ?? 0}/100)`)
  }

  const bullets = reasons.slice(0, 7).map((r) => `✓ ${r}`).join('\n')
  const explanation = `Recommended because:\n${bullets}`

  return {
    ...pkg,
    reasons: reasons.slice(0, 7),
    explanation,
  }
}

export function explainSelectedPackages(
  ranked: PackageCandidate[],
  selectedIds: Set<string>,
): PackageCandidate[] {
  return ranked.map((pkg) => (
    selectedIds.has(pkg.id) ? explainPackage(pkg, ranked) : pkg
  ))
}
