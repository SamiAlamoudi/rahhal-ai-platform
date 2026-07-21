/**
 * Sprint 77 — Complete Trip Optimizer orchestrator.
 */

import type { AgentMemory } from '../types'
import type { BudgetIntelligenceResult } from '../budgetIntelligence/types'
import type { TravelerPersonalizationResult } from '../travelerPersonalization/types'
import {
  hourFromUnknown,
  type FlightLegFacts,
  type HotelStayFacts,
  type ItineraryCandidate,
} from './candidate'
import { buildTripOptimizerDiagnostics } from './diagnostics'
import { computeJourneyScores } from './journeyScore'
import { parseOptimizerIntent } from './parseIntent'
import { assignRecommendationLabels } from './ranking'
import type { OptimizedItinerary, TripOptimizerResult } from './types'
import { SPRINT77_TRIP_OPTIMIZER_VERSION } from './types'

export interface RunTripOptimizerInput {
  memory: AgentMemory
  userText?: string | null
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  budgetIntelligence?: BudgetIntelligenceResult | null
  travelerPersonalization?: TravelerPersonalizationResult | null
  /** Cap combinations for determinism/perf. */
  maxCombinations?: number
}

function readFlights(offers: Array<Record<string, unknown>>): FlightLegFacts[] {
  return offers.map((offer, index) => {
    const durationHours = typeof offer.durationHours === 'number' ? offer.durationHours : null
    const durationMinutes = typeof offer.durationMinutes === 'number'
      ? offer.durationMinutes
      : durationHours != null
        ? Math.round(durationHours * 60)
        : null
    return {
      id: String(offer.id ?? `flt_${index}`),
      airline: typeof offer.airline === 'string' ? offer.airline : 'Flight',
      price: typeof offer.price === 'number' ? offer.price : Number(offer.price) || 0,
      currency: String(offer.currency ?? 'SAR'),
      durationMinutes,
      stops: typeof offer.stops === 'number' ? offer.stops : 0,
      cabin: typeof offer.cabin === 'string' ? offer.cabin : null,
      arrivalHour: hourFromUnknown(offer.arrivalHour ?? offer.arriveHour ?? offer.arrivalTime),
      departureHour: hourFromUnknown(offer.departureHour ?? offer.departHour ?? offer.departureTime),
      layoverMinutes: typeof offer.layoverMinutes === 'number'
        ? offer.layoverMinutes
        : typeof offer.layoverHours === 'number'
          ? Math.round(offer.layoverHours * 60)
          : null,
      payload: offer,
    }
  })
}

function readHotels(stays: Array<Record<string, unknown>>): HotelStayFacts[] {
  return stays.map((stay, index) => {
    const nightly = typeof stay.nightly === 'number'
      ? stay.nightly
      : typeof stay.total === 'number'
        ? stay.total
        : Number(stay.price) || 0
    const total = typeof stay.total === 'number' ? stay.total : nightly
    const name = String(stay.name ?? `Stay ${index + 1}`)
    const stars = typeof stay.hotelStars === 'number'
      ? stay.hotelStars
      : typeof stay.stars === 'number'
        ? stay.stars
        : null
    return {
      id: String(stay.hotelId ?? stay.id ?? `htl_${index}`),
      name,
      chain: typeof stay.chain === 'string' ? stay.chain : typeof stay.brand === 'string' ? stay.brand : null,
      price: total,
      currency: String(stay.currency ?? 'SAR'),
      stars,
      rating: typeof stay.rating === 'number' ? stay.rating : typeof stay.score === 'number' ? stay.score : null,
      walkMinutes: typeof stay.walkMinutes === 'number'
        ? stay.walkMinutes
        : typeof stay.walkingMinutes === 'number'
          ? stay.walkingMinutes
          : typeof stay.distanceKm === 'number'
            ? Math.round(stay.distanceKm * 12)
            : null,
      checkInHour: hourFromUnknown(stay.checkInHour ?? stay.checkIn),
      checkOutHour: hourFromUnknown(stay.checkOutHour ?? stay.checkOut),
      familyFriendly: stay.familyFriendly === true
        || /\bfamily\b|عائل/.test(name.toLowerCase())
        || (stars ?? 0) >= 4,
      businessFriendly: stay.businessFriendly === true
        || /\bbusiness\b|executive|عمل/.test(name.toLowerCase())
        || (stars ?? 0) >= 4,
      payload: { ...stay, nightly, total },
    }
  })
}

function personalizationBoostFor(
  flight: FlightLegFacts,
  hotel: HotelStayFacts,
  personalization?: TravelerPersonalizationResult | null,
): number {
  if (!personalization) return 0
  let boost = 0
  const flightHit = personalization.rankedFlights.find((r) => r.id === flight.id)
  const hotelHit = personalization.rankedHotels.find((r) => r.id === hotel.id)
  if (flightHit) boost += flightHit.delta * 0.5
  if (hotelHit) boost += hotelHit.delta * 0.5
  return Math.max(-30, Math.min(30, boost))
}

function buildCandidates(input: RunTripOptimizerInput): ItineraryCandidate[] {
  const flights = readFlights(input.flightOffers ?? [])
  const hotels = readHotels(input.hotelStays ?? [])
  if (flights.length === 0 || hotels.length === 0) return []

  const budgetCap = input.budgetIntelligence?.diagnostics.amount
    ?? input.memory.requirements.budgetAmount
    ?? null
  const maxCombos = input.maxCombinations ?? 24
  const candidates: ItineraryCandidate[] = []

  for (const flight of flights) {
    for (const hotel of hotels) {
      if (candidates.length >= maxCombos) break
      const totalPrice = flight.price + hotel.price
      const remaining = budgetCap != null ? budgetCap - totalPrice : null
      candidates.push({
        id: `${flight.id}__${hotel.id}`,
        flight,
        hotel,
        totalPrice,
        currency: flight.currency || hotel.currency || 'SAR',
        budgetCap,
        remainingBudget: remaining,
        personalizationBoost: personalizationBoostFor(flight, hotel, input.travelerPersonalization),
        weatherFit: typeof flight.payload.weatherFit === 'number'
          ? flight.payload.weatherFit
          : typeof hotel.payload.weatherFit === 'number'
            ? hotel.payload.weatherFit
            : null,
        riskHint: typeof flight.payload.riskScore === 'number'
          ? flight.payload.riskScore
          : typeof hotel.payload.riskScore === 'number'
            ? hotel.payload.riskScore
            : null,
      })
    }
    if (candidates.length >= maxCombos) break
  }
  return candidates
}

export function runTripOptimizer(input: RunTripOptimizerInput): TripOptimizerResult {
  const started = Date.now()
  const intent = parseOptimizerIntent(input.userText)
  const candidates = buildCandidates(input)

  const scored: OptimizedItinerary[] = candidates.map((candidate) => {
    const { scores, factors, tradeoffs } = computeJourneyScores(candidate, intent)
    const reasons: string[] = []
    if (scores.journeyScore >= 80) reasons.push('strong overall journey fit')
    if (scores.comfortScore >= 80) reasons.push('high comfort')
    if (scores.convenienceScore >= 80) reasons.push('high convenience')
    if (scores.travelTimeScore >= 80) reasons.push('efficient travel time')
    if (scores.businessScore >= 80) reasons.push('business suitable')
    if (scores.familyScore >= 80) reasons.push('family friendly')
    if (scores.luxuryScore >= 80) reasons.push('luxury fit')
    if (scores.budgetScore >= 80) reasons.push('within budget profile')
    if (candidate.personalizationBoost > 5) reasons.push('matches traveler preferences')

    return {
      id: candidate.id,
      title: `${candidate.flight.airline} + ${candidate.hotel.name}`,
      flightId: candidate.flight.id,
      hotelId: candidate.hotel.id,
      totalPrice: candidate.totalPrice,
      currency: candidate.currency,
      scores,
      factors,
      labels: [],
      reasons,
      tradeoffs,
      flight: candidate.flight.payload,
      hotel: candidate.hotel.payload,
    }
  })

  const { labeled, recommendations } = assignRecommendationLabels(scored)

  const budgetEffect = input.budgetIntelligence
    ? (input.budgetIntelligence.diagnostics.budgetScore ?? 0) * 0.2
      + (input.budgetIntelligence.diagnostics.overflow ? -15 : 0)
      + (input.budgetIntelligence.diagnostics.underflow ? 5 : 0)
    : 0

  const personalizationEffect = input.travelerPersonalization
    ? input.travelerPersonalization.diagnostics.rankingAdjustments
      .reduce((sum, adj) => sum + adj.delta, 0) / Math.max(1, input.travelerPersonalization.diagnostics.rankingAdjustments.length)
    : 0

  const diagnostics = buildTripOptimizerDiagnostics({
    itineraries: labeled,
    priority: intent.priority,
    budgetEffect: Math.round(budgetEffect),
    personalizationEffect: Math.round(personalizationEffect),
  })

  const recommendationFacts: string[] = []
  if (recommendations.bestOverall) {
    recommendationFacts.push(
      `Best overall: ${recommendations.bestOverall.title} · Journey ${recommendations.bestOverall.scores.journeyScore}/100`,
    )
  }
  if (recommendations.bestValue && recommendations.bestValue.id !== recommendations.bestOverall?.id) {
    recommendationFacts.push(`Best value: ${recommendations.bestValue.title}`)
  }
  if (intent.priority !== 'balanced') {
    recommendationFacts.push(`Optimizer priority: ${intent.priority}`)
  }
  if (diagnostics.tradeoffs[0]) {
    recommendationFacts.push(`Tradeoff: ${diagnostics.tradeoffs[0].description}`)
  }

  return {
    version: SPRINT77_TRIP_OPTIMIZER_VERSION,
    diagnostics,
    itineraries: labeled,
    recommendations,
    recommendationFacts,
    durationMs: Date.now() - started,
  }
}
