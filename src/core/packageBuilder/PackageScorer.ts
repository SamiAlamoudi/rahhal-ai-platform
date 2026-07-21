/**
 * Sprint 83 — weighted package scoring dimensions.
 */

import {
  DEFAULT_PACKAGE_WEIGHTS,
  type PackageCandidate,
  type PackageScoreDimensions,
  type PackageScoreWeights,
} from './PackageCandidate'

type PreferenceBiases = Partial<{
  luxury: number
  family: number
  price: number
  walkability: number
  comfort: number
}>

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

function component(pkg: PackageCandidate, kind: string) {
  return pkg.components.find((c) => c.kind === kind)
}

export function scorePackageDimensions(pkg: PackageCandidate): PackageScoreDimensions {
  const flight = component(pkg, 'flight')
  const hotel = component(pkg, 'hotel')
  const transfer = component(pkg, 'transfer')
  const activities = pkg.components.filter((c) => c.kind === 'activity')

  const duration = typeof flight?.payload.durationMinutes === 'number'
    ? flight.payload.durationMinutes
    : 300
  const stops = typeof flight?.payload.stops === 'number' ? flight.payload.stops : 1
  const stars = typeof hotel?.payload.stars === 'number' ? hotel.payload.stars : 3
  const rating = typeof hotel?.payload.rating === 'number' ? hotel.payload.rating : 7
  const walk = typeof hotel?.payload.walkMinutes === 'number' ? hotel.payload.walkMinutes : 25
  const transferMins = typeof transfer?.payload.durationMinutes === 'number'
    ? transfer.payload.durationMinutes
    : 45
  const refundableFlight = flight?.payload.refundable === true
  const refundableHotel = hotel?.payload.refundable === true
  const family = hotel?.payload.familyFriendly === true
    || activities.some((a) => a.payload.familyFriendly === true)
  const luxury = hotel?.payload.luxury === true || stars >= 5
  const business = hotel?.payload.businessFriendly === true
    || (typeof flight?.payload.cabin === 'string'
      && /business|first/i.test(flight.payload.cabin))
  const loyalty = flight?.payload.loyaltyMatch === true
  const activityQuality = activities.length === 0
    ? 55
    : activities.reduce((s, a) => s + (typeof a.payload.quality === 'number' ? a.payload.quality : 70), 0)
      / activities.length

  const totalCost = clamp(100 - Math.min(90, pkg.totalPrice / 80))
  const travelTime = clamp(100 - (duration / 8) - stops * 12)
  const hotelRating = clamp(stars * 12 + rating * 4)
  const walkingDistance = clamp(100 - walk * 2.2)
  const transferTime = clamp(100 - transferMins * 1.5)
  const cancellationFlexibility = clamp(
    (refundableFlight ? 45 : 15) + (refundableHotel ? 45 : 15),
  )
  const familySuitability = family ? 88 : 45
  const luxuryLevel = luxury ? 90 : clamp(stars * 14)
  const businessSuitability = business ? 90 : 48
  const loyaltyBenefits = loyalty ? 85 : 40
  const activityQualityScore = clamp(activityQuality)
  const overallValue = clamp(
    totalCost * 0.35
      + hotelRating * 0.2
      + travelTime * 0.15
      + cancellationFlexibility * 0.1
      + walkingDistance * 0.1
      + activityQualityScore * 0.1,
  )

  return {
    total_cost: Math.round(totalCost),
    travel_time: Math.round(travelTime),
    hotel_rating: Math.round(hotelRating),
    walking_distance: Math.round(walkingDistance),
    transfer_time: Math.round(transferTime),
    cancellation_flexibility: Math.round(cancellationFlexibility),
    family_suitability: Math.round(familySuitability),
    luxury_level: Math.round(luxuryLevel),
    business_suitability: Math.round(businessSuitability),
    loyalty_benefits: Math.round(loyaltyBenefits),
    activity_quality: Math.round(activityQualityScore),
    overall_value: Math.round(overallValue),
  }
}

export function applyWeights(
  dimensions: PackageScoreDimensions,
  weights: PackageScoreWeights = DEFAULT_PACKAGE_WEIGHTS,
  biases?: PreferenceBiases,
): number {
  let score = 0
  let weightSum = 0
  for (const key of Object.keys(dimensions) as Array<keyof PackageScoreDimensions>) {
    let w = weights[key]
    if (biases) {
      if (key === 'total_cost') w += (biases.price ?? 0) * 0.1
      if (key === 'luxury_level') w += (biases.luxury ?? 0) * 0.1
      if (key === 'family_suitability') w += (biases.family ?? 0) * 0.1
      if (key === 'walking_distance') w += (biases.walkability ?? 0) * 0.1
      if (key === 'travel_time' || key === 'business_suitability') {
        w += (biases.comfort ?? 0) * 0.05
      }
    }
    score += dimensions[key] * w
    weightSum += w
  }
  const base = weightSum > 0 ? score / weightSum : 0
  return clamp(base)
}

export function scorePackage(
  pkg: PackageCandidate,
  weights: PackageScoreWeights = DEFAULT_PACKAGE_WEIGHTS,
  biases?: PreferenceBiases,
  priceTimingBoost?: number | null,
): PackageCandidate {
  const dimensions = scorePackageDimensions(pkg)
  let overall = applyWeights(dimensions, weights, biases)
  if (typeof priceTimingBoost === 'number' && priceTimingBoost > 0) {
    // Soft enrichment from Price Intelligence confidence (0–100) — no duplicate pricing logic.
    overall = clamp(overall + (priceTimingBoost / 100) * 4)
  }
  return {
    ...pkg,
    dimensions,
    score: Math.round(overall * 10) / 10,
  }
}

export async function scorePackagesParallel(
  packages: PackageCandidate[],
  weights?: PackageScoreWeights,
  biases?: PreferenceBiases,
  priceTimingBoost?: number | null,
): Promise<PackageCandidate[]> {
  return Promise.all(
    packages.map(async (pkg) => scorePackage(pkg, weights, biases, priceTimingBoost)),
  )
}
