/**
 * Intelligent Decision Engine — ranks provider outputs and enriches TripPlan.
 * TravelAgentService stays provider-blind: this module only sees tool payloads.
 */

import type { AgentToolResult } from '../tools/types'
import type {
  AccommodationRecommendation,
  FlightRecommendation,
  TripPlan,
  TripRequirements,
} from '../types'
import { detectTripConflicts } from './detectConflicts'
import {
  computeTripScores,
  scoreFlightCandidate,
  scoreHotelCandidate,
  type ScoredCandidate,
} from './scoreComponents'
import type {
  DecisionAlternative,
  DecisionRationale,
  TripDecision,
} from './types'

export function applyIntelligentDecisions(
  plan: TripPlan,
  toolResults: AgentToolResult[],
  requirements: TripRequirements,
): TripPlan {
  const flightOffers = readOffers(toolResults, 'flights')
  const hotelStays = readStays(toolResults, 'hotels')
  const attractionAreas = collectAttractionAreas(plan)

  const nights = Math.max(1, plan.durationDays - 1)
  const budgetNightly = requirements.budgetAmount != null
    ? Math.round((requirements.budgetAmount * 0.35) / nights)
    : null

  const scoredFlights = flightOffers.map((offer, index) =>
    scoreFlightCandidate(offer, index, requirements.budgetAmount))
  const scoredHotels = hotelStays.map((stay, index) =>
    scoreHotelCandidate(stay, index, attractionAreas, budgetNightly))

  scoredFlights.sort((a, b) => b.score - a.score)
  scoredHotels.sort((a, b) => b.score - a.score)

  let next = plan
  const alternatives: DecisionAlternative[] = []

  const flightPick = scoredFlights[0] ?? null
  const hotelPick = scoredHotels[0] ?? null

  if (flightPick) {
    next = applySelectedFlight(next, flightPick)
    for (const alt of scoredFlights.slice(1, 4)) {
      alternatives.push({
        kind: 'flight',
        title: alt.title,
        reasonRejected: rejectReason(alt, flightPick, 'flight'),
        score: alt.score,
      })
    }
  }

  if (hotelPick) {
    next = applySelectedHotel(next, hotelPick)
    for (const alt of scoredHotels.slice(1, 4)) {
      alternatives.push({
        kind: 'hotel',
        title: alt.title,
        reasonRejected: rejectReason(alt, hotelPick, 'hotel'),
        score: alt.score,
      })
    }
  }

  // Avoid bad-weather outdoor blocks when still flagged after weather merge
  next = softenOutdoorOnRainyDays(next)

  const mapsDuration = totalMapsDurationMinutes(toolResults)
  const flightScore = flightPick?.score
    ?? (next.flights[0] ? scoreFlightFromPlan(next.flights[0], requirements.budgetAmount) : 50)
  const hotelScore = hotelPick?.score
    ?? (next.accommodations[0]
      ? scoreHotelFromPlan(next.accommodations[0], attractionAreas, budgetNightly)
      : 50)

  const scores = computeTripScores({
    plan: next,
    requirements,
    flightScore,
    hotelScore,
    mapsDurationMinutes: mapsDuration,
  })

  const conflicts = detectTripConflicts(next, requirements)
  const suggestions = buildSuggestions(conflicts, scores, flightPick, hotelPick)

  const decision: TripDecision = {
    scores,
    flight: flightPick
      ? toRationale(flightPick, scoredFlights.slice(1), 'flight', next.estimatedBudget.currency)
      : null,
    hotel: hotelPick
      ? toRationale(hotelPick, scoredHotels.slice(1), 'hotel', next.estimatedBudget.currency)
      : null,
    activities: buildActivitiesRationale(next, scores.dailyItinerary),
    conflicts,
    alternatives,
    suggestions,
    version: 1,
  }

  // Surface a short score note without altering core plan identity fields
  const scoreNote = `Decision score ${scores.overall}/100 · flight ${scores.flight} · hotel ${scores.hotel} · days ${scores.dailyItinerary}`
  const notes = [
    ...next.notes.filter((n) => !/^Decision score\b/i.test(n)),
    scoreNote,
  ]

  return {
    ...next,
    decision,
    notes,
  }
}

function readToolData(results: AgentToolResult[], tool: string): Record<string, unknown> {
  const row = results.find((r) => r.tool === tool && r.status === 'ok')
  return (row?.data && typeof row.data === 'object') ? row.data as Record<string, unknown> : {}
}

function readOffers(results: AgentToolResult[], tool: string): Array<Record<string, unknown>> {
  const offers = readToolData(results, tool).offers
  return Array.isArray(offers) ? offers as Array<Record<string, unknown>> : []
}

function readStays(results: AgentToolResult[], tool: string): Array<Record<string, unknown>> {
  const stays = readToolData(results, tool).stays
  return Array.isArray(stays) ? stays as Array<Record<string, unknown>> : []
}

function collectAttractionAreas(plan: TripPlan): string[] {
  const areas = new Set<string>()
  for (const day of plan.dailyItinerary) {
    if (day.location) areas.add(day.location)
  }
  for (const attraction of plan.attractions) {
    if (attraction.title) areas.add(attraction.title)
  }
  return [...areas]
}

function applySelectedFlight(plan: TripPlan, pick: ScoredCandidate): TripPlan {
  const providerFlights = plan.flights.filter((f) => f.fromProvider === true)
  // Booking inventory must stay selectable — never collapse provider offers to one thin row.
  if (providerFlights.length > 0) {
    const top = providerFlights[0]!
    const transport = {
      mode: 'flight',
      from: top.from,
      to: top.to,
      notes: `${pick.reasons.join(' · ') || 'Selected by decision engine'} · score ${Math.round(pick.score)}`,
      estimatedCost: top.estimatedCost,
      currency: top.currency,
    }
    let estimatedBudget = plan.estimatedBudget
    if (top.estimatedCost != null) {
      const previousFlight = estimatedBudget.breakdown.find((b) => b.label === 'flights')?.amount ?? 0
      estimatedBudget = {
        ...estimatedBudget,
        amount: estimatedBudget.amount - previousFlight + top.estimatedCost,
        breakdown: [
          ...estimatedBudget.breakdown.filter((b) => b.label !== 'flights'),
          { label: 'flights', amount: top.estimatedCost },
        ],
      }
    }
    return {
      ...plan,
      flights: providerFlights,
      transportation: [transport, ...plan.transportation.filter((t) => t.mode !== 'flight')],
      estimatedBudget,
      estimatedCosts: estimatedBudget,
    }
  }

  const offer = pick.payload
  const flight: FlightRecommendation = {
    from: String(offer.from ?? plan.flights[0]?.from ?? 'Origin'),
    to: String(offer.to ?? plan.destinations[0] ?? 'Destination'),
    airline: typeof offer.airline === 'string' ? offer.airline : null,
    stops: typeof offer.stops === 'number' ? offer.stops : null,
    estimatedCost: typeof offer.price === 'number' ? offer.price : null,
    currency: typeof offer.currency === 'string' ? offer.currency : plan.estimatedBudget.currency,
    notes: `${pick.reasons.join(' · ') || 'Selected by decision engine'} · score ${Math.round(pick.score)}`,
  }
  const transport = {
    mode: 'flight',
    from: flight.from,
    to: flight.to,
    notes: flight.notes,
    estimatedCost: flight.estimatedCost,
    currency: flight.currency,
  }
  let estimatedBudget = plan.estimatedBudget
  if (flight.estimatedCost != null) {
    const previousFlight = estimatedBudget.breakdown.find((b) => b.label === 'flights')?.amount ?? 0
    estimatedBudget = {
      ...estimatedBudget,
      amount: estimatedBudget.amount - previousFlight + flight.estimatedCost,
      breakdown: [
        ...estimatedBudget.breakdown.filter((b) => b.label !== 'flights'),
        { label: 'flights', amount: flight.estimatedCost },
      ],
    }
  }
  return {
    ...plan,
    flights: [flight],
    transportation: [transport, ...plan.transportation.filter((t) => t.mode !== 'flight')],
    estimatedBudget,
    estimatedCosts: estimatedBudget,
  }
}

function applySelectedHotel(plan: TripPlan, pick: ScoredCandidate): TripPlan {
  const providerHotels = plan.accommodations.filter((h) => h.fromProvider === true)
  if (providerHotels.length > 0) {
    return { ...plan, accommodations: providerHotels }
  }
  const stay = pick.payload
  const hotel: AccommodationRecommendation = {
    name: String(stay.name ?? pick.title),
    area: String(stay.area ?? 'Center'),
    category: normalizeCategory(stay.category),
    fit: `Selected by decision engine: ${pick.reasons.join(', ') || 'best overall fit'}`,
    estimatedNightly: typeof stay.nightly === 'number' ? stay.nightly : null,
    currency: typeof stay.currency === 'string' ? stay.currency : plan.estimatedBudget.currency,
  }
  return {
    ...plan,
    accommodations: [hotel],
  }
}

function softenOutdoorOnRainyDays(plan: TripPlan): TripPlan {
  const dailyItinerary = plan.dailyItinerary.map((day) => {
    const weather = day.weather
    if (!weather) return day
    const rainy = weather.condition === 'rain' || weather.condition === 'thunderstorm'
      || (weather.rainProbability != null && weather.rainProbability >= 0.5)
    if (!rainy) return day
    const activities = day.activities.map((activity) => {
      const outdoor = /park|hike|beach|outdoor|walk|garden|cruise/i.test(
        `${activity.title} ${activity.description ?? ''}`,
      )
      if (!outdoor) return activity
      return {
        ...activity,
        description: activity.description
          ? `${activity.description} · move indoors if rain persists`
          : 'Swap to an indoor option if rain persists',
      }
    })
    return { ...day, activities }
  })
  return {
    ...plan,
    dailyItinerary,
    activities: dailyItinerary,
  }
}

function toRationale(
  winner: ScoredCandidate,
  losers: ScoredCandidate[],
  kind: 'flight' | 'hotel',
  currency: string,
): DecisionRationale {
  const whySelected = kind === 'flight'
    ? `Chose ${winner.title} (score ${Math.round(winner.score)}) — ${winner.reasons.join('; ') || 'best time/price balance'}`
    : `Chose ${winner.title} (score ${Math.round(winner.score)}) — ${winner.reasons.join('; ') || 'best location/value balance'}`

  const whyAlternativesRejected = losers.slice(0, 3).map((alt) =>
    `${alt.title}: ${rejectReason(alt, winner, kind)}`)

  let savings: number | null = null
  const pricedLosers = losers.filter((l) => l.price != null)
  if (winner.price != null && pricedLosers.length) {
    const avgLoser = pricedLosers.reduce((s, l) => s + (l.price ?? 0), 0) / pricedLosers.length
    const delta = avgLoser - winner.price
    savings = Math.abs(delta) >= 1 ? Math.round(delta) : null
  }

  let timeSaved: number | null = null
  if (kind === 'flight' && winner.durationMinutes != null) {
    const slower = losers.filter((l) => l.durationMinutes != null)
    if (slower.length) {
      const avg = slower.reduce((s, l) => s + (l.durationMinutes ?? 0), 0) / slower.length
      const delta = Math.round(avg - winner.durationMinutes)
      timeSaved = delta > 0 ? delta : null
    } else if (winner.stops === 0) {
      timeSaved = 90
    }
  }

  return {
    whySelected,
    whyAlternativesRejected,
    confidence: clamp01(winner.score / 100),
    estimatedSavings: savings,
    estimatedTimeSavedMinutes: timeSaved,
    currency,
  }
}

function buildActivitiesRationale(plan: TripPlan, dayScore: number): DecisionRationale {
  const rainyDays = plan.dailyItinerary.filter((d) =>
    d.weather?.condition === 'rain' || d.weather?.condition === 'thunderstorm').length
  const whySelected = rainyDays > 0
    ? `Built a ${plan.dailyItinerary.length}-day rhythm with indoor fallbacks on ${rainyDays} wet day(s) (day score ${dayScore})`
    : `Sequenced ${plan.dailyItinerary.length} days around interests (${plan.interests.slice(0, 3).join(', ') || 'local highlights'}) — day score ${dayScore}`
  return {
    whySelected,
    whyAlternativesRejected: plan.attractions.slice(1, 4).map((a) =>
      `${a.title}: kept as optional / lower day priority`),
    confidence: clamp01(dayScore / 100),
    estimatedSavings: null,
    estimatedTimeSavedMinutes: null,
    currency: plan.estimatedBudget.currency,
  }
}

function rejectReason(alt: ScoredCandidate, winner: ScoredCandidate, kind: 'flight' | 'hotel'): string {
  if (kind === 'flight') {
    if ((alt.stops ?? 0) > (winner.stops ?? 0)) return `more stops (${alt.stops} vs ${winner.stops})`
    if ((alt.durationMinutes ?? 0) > (winner.durationMinutes ?? 0) + 45) {
      return 'longer total travel time'
    }
    if ((alt.price ?? 0) > (winner.price ?? 0) + 40) return 'higher fare for similar quality'
    if (alt.score < winner.score - 5) return `lower overall score (${Math.round(alt.score)} vs ${Math.round(winner.score)})`
    return 'narrowly outranked on time/price balance'
  }
  if (winner.reasons.some((r) => /near attractions|central/i.test(r))
    && !alt.reasons.some((r) => /near attractions|central/i.test(r))) {
    return 'farther from key attractions'
  }
  if ((alt.rating ?? 0) + 0.3 < (winner.rating ?? 0)) return 'lower guest rating'
  if ((alt.price ?? 0) > (winner.price ?? 0) * 1.15) return 'worse nightly value'
  return `lower overall score (${Math.round(alt.score)} vs ${Math.round(winner.score)})`
}

function buildSuggestions(
  conflicts: ReturnType<typeof detectTripConflicts>,
  scores: ReturnType<typeof computeTripScores>,
  flight: ScoredCandidate | null,
  hotel: ScoredCandidate | null,
): string[] {
  const suggestions = conflicts
    .map((c) => c.suggestion)
    .filter((s): s is string => Boolean(s))

  if (scores.budget < 50) {
    suggestions.push('Tighten hotel nightly rate or pick a one-stop flight to recover budget')
  }
  if (scores.timeEfficiency < 55) {
    suggestions.push('Cut a multi-stop transfer or reduce same-day long hops')
  }
  if (flight && (flight.stops ?? 0) >= 2) {
    suggestions.push('Consider a nonstop alternative even at a modest fare premium')
  }
  if (hotel && !hotel.reasons.some((r) => /near|central/i.test(r))) {
    suggestions.push('Look for a stay closer to your first walking cluster')
  }
  return [...new Set(suggestions)].slice(0, 6)
}

function totalMapsDurationMinutes(results: AgentToolResult[]): number | null {
  const legs = readToolData(results, 'maps').legs
  if (!Array.isArray(legs) || !legs.length) return null
  return legs.reduce<number>((sum, leg) => {
    const minutes = typeof (leg as { durationMinutes?: number }).durationMinutes === 'number'
      ? (leg as { durationMinutes: number }).durationMinutes
      : 0
    return sum + minutes
  }, 0)
}

function scoreFlightFromPlan(flight: FlightRecommendation, budget: number | null): number {
  return scoreFlightCandidate({
    airline: flight.airline,
    from: flight.from,
    to: flight.to,
    stops: flight.stops,
    price: flight.estimatedCost,
    currency: flight.currency,
  }, 0, budget).score
}

function scoreHotelFromPlan(
  hotel: AccommodationRecommendation,
  areas: string[],
  budgetNightly: number | null,
): number {
  return scoreHotelCandidate({
    name: hotel.name,
    area: hotel.area,
    category: hotel.category,
    nightly: hotel.estimatedNightly,
    currency: hotel.currency,
  }, 0, areas, budgetNightly).score
}

function normalizeCategory(value: unknown): AccommodationRecommendation['category'] {
  if (value === 'resort' || value === 'apartment' || value === 'boutique' || value === 'hotel') {
    return value
  }
  return 'hotel'
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
