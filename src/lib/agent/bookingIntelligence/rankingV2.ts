/**
 * Ranking Engine v2 — never sorts by price alone.
 */

import type { BookingTravelerPreferences, FusedOffer, RankedOffer } from './types'

export function rankOffersV2(input: {
  offers: FusedOffer[]
  preferences: BookingTravelerPreferences
  budgetAmount?: number | null
}): RankedOffer[] {
  const scored = input.offers.map((offer) => scoreOffer(offer, input.preferences, input.budgetAmount ?? null))
  scored.sort((a, b) => b.rankScore - a.rankScore)
  return scored
}

function scoreOffer(
  offer: FusedOffer,
  preferences: BookingTravelerPreferences,
  budgetAmount: number | null,
): RankedOffer {
  const priceValue = offer.price.normalizedAmount ?? offer.price.amount
  const price = priceScore(priceValue, budgetAmount, preferences.budgetStyle)
  const quality = clamp01(offer.qualityScore ?? offer.confidence)
  const location = clamp01(offer.locationScore ?? locationFromWalking(offer.walkingDistanceMeters, preferences))
  const rating = clamp01((offer.rating ?? 3.5) / 5)
  const duration = durationScore(offer.durationMinutes)
  const layover = layoverScore(offer.layoverCount, offer.layoverQuality)
  const refund = refundScore(offer.refundPolicy, offer.refundable)
  const preference = preferenceScore(offer, preferences)
  const pastSelection = pastSelectionScore(offer, preferences)

  // Intentionally diversified — price is never dominant.
  const weights = {
    price: 0.16,
    quality: 0.16,
    location: 0.12,
    rating: 0.12,
    duration: 0.1,
    layover: 0.08,
    refund: 0.1,
    preference: 0.1,
    pastSelection: 0.06,
  }

  const rankScore =
    price * weights.price
    + quality * weights.quality
    + location * weights.location
    + rating * weights.rating
    + duration * weights.duration
    + layover * weights.layover
    + refund * weights.refund
    + preference * weights.preference
    + pastSelection * weights.pastSelection

  return {
    ...offer,
    rankScore: clamp01(rankScore),
    rankFactors: {
      price,
      quality,
      location,
      rating,
      duration,
      layover,
      refund,
      preference,
      pastSelection,
    },
  }
}

function priceScore(
  price: number,
  budget: number | null,
  style: BookingTravelerPreferences['budgetStyle'],
): number {
  if (budget != null && budget > 0) {
    const ratio = price / budget
    if (ratio <= 0.35) return style === 'luxury' ? 0.55 : 0.95
    if (ratio <= 0.55) return 0.85
    if (ratio <= 0.75) return 0.7
    if (ratio <= 1) return 0.5
    return Math.max(0.1, 1 - Math.min(ratio, 2) / 2)
  }
  // No budget: mid prices score better than extremes for balanced travelers.
  const soft = 1 / (1 + price / 5000)
  return style === 'budget' ? soft : clamp01(0.4 + soft * 0.5)
}

function locationFromWalking(
  meters: number | null | undefined,
  preferences: BookingTravelerPreferences,
): number {
  if (meters == null) return 0.55
  const max = preferences.maxWalkingDistanceMeters ?? 1500
  if (meters <= max * 0.4) return 0.98
  if (meters <= max) return 0.8
  if (meters <= max * 1.5) return 0.55
  return 0.3
}

function durationScore(minutes: number | null | undefined): number {
  if (minutes == null) return 0.55
  if (minutes <= 360) return 0.95
  if (minutes <= 600) return 0.8
  if (minutes <= 840) return 0.55
  return 0.3
}

function layoverScore(
  count: number | null | undefined,
  quality: number | null | undefined,
): number {
  if (count == null) return 0.55
  if (count === 0) return 1
  if (count === 1) return clamp01(0.45 + (quality ?? 0.5) * 0.35)
  return clamp01(0.2 + (quality ?? 0.4) * 0.2)
}

function refundScore(
  policy: BookingOfferLike['refundPolicy'],
  refundable: boolean | null | undefined,
): number {
  if (policy === 'flexible' || refundable === true) return 0.95
  if (policy === 'moderate') return 0.7
  if (policy === 'strict' || refundable === false) return 0.35
  return 0.5
}

type BookingOfferLike = Pick<
  FusedOffer,
  | 'title'
  | 'airline'
  | 'hotelChain'
  | 'seatType'
  | 'stars'
  | 'mealIncluded'
  | 'providerId'
  | 'id'
  | 'refundPolicy'
  | 'refundable'
  | 'walkingDistanceMeters'
  | 'durationMinutes'
  | 'layoverCount'
  | 'layoverQuality'
  | 'rating'
  | 'qualityScore'
  | 'locationScore'
  | 'price'
  | 'domain'
>

function preferenceScore(offer: BookingOfferLike, preferences: BookingTravelerPreferences): number {
  let score = 0.45
  const title = offer.title.toLowerCase()
  for (const airline of preferences.preferredAirlines) {
    if ((offer.airline || title).toLowerCase().includes(airline.toLowerCase())) score = Math.max(score, 0.95)
  }
  for (const chain of preferences.preferredHotelChains) {
    if ((offer.hotelChain || title).toLowerCase().includes(chain.toLowerCase())) score = Math.max(score, 0.92)
  }
  if (preferences.seatType && preferences.seatType !== 'any' && offer.seatType === preferences.seatType) {
    score = Math.max(score, 0.85)
  }
  if (preferences.hotelStarsMin != null && offer.stars != null && offer.stars >= preferences.hotelStarsMin) {
    score = Math.max(score, 0.88)
  }
  if (preferences.mealPreference && offer.mealIncluded) score = Math.max(score, 0.8)
  if (preferences.persona === 'luxury' && (offer.stars ?? 0) >= 5) score = Math.max(score, 0.9)
  if (preferences.persona === 'business' && (offer.layoverCount === 0 || offer.refundPolicy === 'flexible')) {
    score = Math.max(score, 0.86)
  }
  if (preferences.persona === 'family' && (offer.stars ?? 0) >= 4) score = Math.max(score, 0.8)
  return clamp01(score)
}

function pastSelectionScore(offer: BookingOfferLike, preferences: BookingTravelerPreferences): number {
  if (preferences.pastSelectedOfferIds.includes(offer.id)) return 1
  if (preferences.pastSelectedProviderIds.includes(offer.providerId)) return 0.75
  return 0.4
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
