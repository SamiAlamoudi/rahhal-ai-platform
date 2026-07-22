/**
 * Sprint 110 — TripRanking
 * Labels trips: Best Overall / Budget / Luxury / Family / Business / Value /
 * Short Stay / Long Stay.
 */

import type { TripCandidate, TripRankKind, TripRankedGroup } from './types'

const RANK_DEFS: Array<{ kind: TripRankKind; label: string }> = [
  { kind: 'best_overall', label: 'Best Overall' },
  { kind: 'best_budget', label: 'Best Budget' },
  { kind: 'best_luxury', label: 'Best Luxury' },
  { kind: 'best_family', label: 'Best Family' },
  { kind: 'best_business', label: 'Best Business' },
  { kind: 'best_value', label: 'Best Value' },
  { kind: 'best_short_stay', label: 'Best Short Stay' },
  { kind: 'best_long_stay', label: 'Best Long Stay' },
]

function isFamilyTrip(trip: TripCandidate): boolean {
  return trip.hotel.amenities.some((a) => /FAMILY|KID|CHILD|POOL/i.test(a))
    || (trip.hotel.stars ?? 0) >= 3
}

function isBusinessTrip(trip: TripCandidate): boolean {
  const cabin = (trip.flight.cabin ?? '').toLowerCase()
  const amenities = trip.hotel.amenities.some((a) =>
    /WIFI|BUSINESS|MEETING|WORK/i.test(a),
  )
  return cabin.includes('business') || cabin.includes('first') || amenities
}

function luxuryScore(trip: TripCandidate): number {
  const stars = trip.hotel.stars ?? 0
  const cabinBoost =
    /first|business|premium/i.test(trip.flight.cabin ?? '') ? 2 : 0
  return stars * 10 + cabinBoost + trip.cost.totalCost / 1000
}

function valueScore(trip: TripCandidate): number {
  if (trip.cost.totalCost <= 0) return 0
  return trip.travelQuality / trip.cost.totalCost
}

export function rankTrips(trips: TripCandidate[]): {
  ranked: TripCandidate[]
  rankings: TripRankedGroup[]
  selected: TripCandidate | null
} {
  const compatible = trips.filter((t) => t.compatible)
  const pool = compatible.length > 0 ? compatible : trips

  const byScore = [...pool].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id),
  )

  const pickBudget = (): TripCandidate | null => {
    const priced = pool.filter((t) => t.cost.totalCost > 0)
    if (priced.length === 0) return null
    return [...priced].sort(
      (a, b) =>
        a.cost.totalCost - b.cost.totalCost || a.id.localeCompare(b.id),
    )[0] ?? null
  }

  const pickLuxury = (): TripCandidate | null => {
    if (pool.length === 0) return null
    return [...pool].sort(
      (a, b) => luxuryScore(b) - luxuryScore(a) || a.id.localeCompare(b.id),
    )[0] ?? null
  }

  const pickFamily = (): TripCandidate | null => {
    const family = pool.filter(isFamilyTrip)
    const src = family.length > 0 ? family : pool
    return [...src].sort(
      (a, b) => b.score - a.score || a.id.localeCompare(b.id),
    )[0] ?? null
  }

  const pickBusiness = (): TripCandidate | null => {
    const biz = pool.filter(isBusinessTrip)
    const src = biz.length > 0 ? biz : pool
    return [...src].sort(
      (a, b) => b.travelQuality - a.travelQuality || a.id.localeCompare(b.id),
    )[0] ?? null
  }

  const pickValue = (): TripCandidate | null => {
    if (pool.length === 0) return null
    return [...pool].sort(
      (a, b) => valueScore(b) - valueScore(a) || a.id.localeCompare(b.id),
    )[0] ?? null
  }

  const pickShortStay = (): TripCandidate | null => {
    if (pool.length === 0) return null
    return [...pool].sort(
      (a, b) =>
        a.nights - b.nights
        || b.score - a.score
        || a.id.localeCompare(b.id),
    )[0] ?? null
  }

  const pickLongStay = (): TripCandidate | null => {
    if (pool.length === 0) return null
    return [...pool].sort(
      (a, b) =>
        b.nights - a.nights
        || b.score - a.score
        || a.id.localeCompare(b.id),
    )[0] ?? null
  }

  const pickers: Record<TripRankKind, () => TripCandidate | null> = {
    best_overall: () => byScore[0] ?? null,
    best_budget: pickBudget,
    best_luxury: pickLuxury,
    best_family: pickFamily,
    best_business: pickBusiness,
    best_value: pickValue,
    best_short_stay: pickShortStay,
    best_long_stay: pickLongStay,
  }

  const rankings: TripRankedGroup[] = RANK_DEFS.map(({ kind, label }) => ({
    kind,
    label,
    trip: pickers[kind](),
  }))

  // Attach labels to trips
  const labelMap = new Map<string, TripRankKind[]>()
  for (const group of rankings) {
    if (!group.trip) continue
    const list = labelMap.get(group.trip.id) ?? []
    list.push(group.kind)
    labelMap.set(group.trip.id, list)
  }

  const ranked = byScore.map((t) => ({
    ...t,
    labels: labelMap.get(t.id) ?? [],
  }))

  // Sync labels onto rankings.trip references
  const byId = new Map(ranked.map((t) => [t.id, t]))
  const rankingsSynced = rankings.map((g) => ({
    ...g,
    trip: g.trip ? byId.get(g.trip.id) ?? g.trip : null,
  }))

  return {
    ranked,
    rankings: rankingsSynced,
    selected: ranked[0] ?? null,
  }
}

export class TripRanking {
  rank(trips: TripCandidate[]) {
    return rankTrips(trips)
  }
}

export function createTripRanking(): TripRanking {
  return new TripRanking()
}
