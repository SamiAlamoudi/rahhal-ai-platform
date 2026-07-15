import type { TripPlan, TripRequirements } from '../types'
import type { TripDecisionScores } from './types'

export interface ScoredCandidate {
  index: number
  title: string
  score: number
  price: number | null
  durationMinutes: number | null
  rating: number | null
  stops: number | null
  area: string | null
  reasons: string[]
  payload: Record<string, unknown>
}

export function scoreFlightCandidate(
  offer: Record<string, unknown>,
  index: number,
  budget: number | null,
): ScoredCandidate {
  const price = num(offer.price)
  const stops = num(offer.stops) ?? 0
  const durationHours = num(offer.durationHours)
  const durationMinutes = durationHours != null ? Math.round(durationHours * 60) : null
  const rating = num(offer.rating)
  let score = 70
  const reasons: string[] = []

  // Minimize travel time / stops
  if (stops === 0) {
    score += 15
    reasons.push('nonstop')
  } else if (stops === 1) {
    score += 5
    reasons.push('one stop')
  } else {
    score -= stops * 8
    reasons.push(`${stops} stops`)
  }

  if (durationMinutes != null) {
    if (durationMinutes <= 480) score += 10
    else if (durationMinutes <= 720) score += 4
    else score -= 8
  }

  // Balance price vs quality
  if (price != null && budget != null && budget > 0) {
    const ratio = price / budget
    if (ratio <= 0.25) {
      score += 12
      reasons.push('fits budget well')
    } else if (ratio <= 0.4) {
      score += 6
    } else if (ratio > 0.6) {
      score -= 12
      reasons.push('expensive vs trip budget')
    }
  } else if (price != null) {
    score += Math.max(-10, 15 - price / 100)
  }

  if (rating != null) {
    score += clamp((rating / 5) * 8, 0, 8)
    if (rating >= 4) reasons.push('highly rated carrier')
  }

  return {
    index,
    title: `${String(offer.airline ?? 'Airline')} ${String(offer.from ?? '')}→${String(offer.to ?? '')}`,
    score: clamp(score, 0, 100),
    price,
    durationMinutes,
    rating,
    stops,
    area: null,
    reasons,
    payload: offer,
  }
}

export function scoreHotelCandidate(
  stay: Record<string, unknown>,
  index: number,
  attractionAreas: string[],
  budgetNightly: number | null,
): ScoredCandidate {
  const nightly = num(stay.nightly) ?? num(stay.estimatedNightly)
  const rating = num(stay.rating) ?? num(stay.hotelStars)
  const area = typeof stay.area === 'string' ? stay.area : null
  let score = 65
  const reasons: string[] = []

  // Prefer hotels near attractions
  if (area && attractionAreas.length) {
    const near = attractionAreas.some((a) =>
      a.toLowerCase().includes(area.toLowerCase())
      || area.toLowerCase().includes(a.toLowerCase().slice(0, 4)))
    if (near) {
      score += 18
      reasons.push(`near attractions (${area})`)
    } else {
      score -= 4
    }
  } else if (area && /center|central|downtown|وسط|مركز/i.test(area)) {
    score += 12
    reasons.push('central area')
  }

  // Prefer highly rated places
  if (rating != null) {
    if (rating >= 8 || rating >= 4.5) {
      score += 14
      reasons.push('highly rated')
    } else if (rating >= 7 || rating >= 4) {
      score += 8
    } else if (rating < 6 && rating > 5) {
      score -= 4
    } else if (rating < 3.5) {
      score -= 10
    }
  }

  if (nightly != null && budgetNightly != null && budgetNightly > 0) {
    const ratio = nightly / budgetNightly
    if (ratio <= 1) {
      score += 10
      reasons.push('within nightly budget')
    } else if (ratio <= 1.25) {
      score += 2
    } else {
      score -= 14
      reasons.push('above nightly budget')
    }
  }

  if (stay.breakfastIncluded === true) {
    score += 3
    reasons.push('breakfast included')
  }
  if (stay.freeCancellation === true) {
    score += 3
    reasons.push('free cancellation')
  }

  return {
    index,
    title: String(stay.name ?? `Stay ${index + 1}`),
    score: clamp(score, 0, 100),
    price: nightly,
    durationMinutes: null,
    rating,
    stops: null,
    area,
    reasons,
    payload: stay,
  }
}

export function computeTripScores(input: {
  plan: TripPlan
  requirements: TripRequirements
  flightScore: number
  hotelScore: number
  mapsDurationMinutes: number | null
}): TripDecisionScores {
  const dailyItinerary = scoreDailyItinerary(input.plan)
  const budget = scoreBudget(input.plan, input.requirements)
  const comfort = scoreComfort(input.plan, input.flightScore, input.hotelScore)
  const timeEfficiency = scoreTimeEfficiency(input.plan, input.mapsDurationMinutes)

  const overall = Math.round(
    input.flightScore * 0.2
    + input.hotelScore * 0.2
    + dailyItinerary * 0.2
    + budget * 0.15
    + comfort * 0.15
    + timeEfficiency * 0.1,
  )

  return {
    overall: clamp(overall, 0, 100),
    flight: clamp(Math.round(input.flightScore), 0, 100),
    hotel: clamp(Math.round(input.hotelScore), 0, 100),
    dailyItinerary: clamp(Math.round(dailyItinerary), 0, 100),
    budget: clamp(Math.round(budget), 0, 100),
    comfort: clamp(Math.round(comfort), 0, 100),
    timeEfficiency: clamp(Math.round(timeEfficiency), 0, 100),
  }
}

function scoreDailyItinerary(plan: TripPlan): number {
  if (!plan.dailyItinerary.length) return 40
  let total = 0
  for (const day of plan.dailyItinerary) {
    let dayScore = 70
    const count = day.activities.length
    if (count === 0) dayScore -= 20
    else if (count >= 2 && count <= 4) dayScore += 12
    else if (count === 5) dayScore += 4
    else if (count > 6) dayScore -= 18 // overcrowded / impossible schedule

    const weather = day.weather
    if (weather) {
      const rainy = weather.condition === 'rain' || weather.condition === 'thunderstorm'
        || (weather.rainProbability != null && weather.rainProbability >= 0.45)
      if (rainy) {
        const outdoorHeavy = day.activities.filter((a) =>
          /park|hike|beach|outdoor|walk|garden|temple stroll/i.test(`${a.title} ${a.description ?? ''}`)).length
        if (outdoorHeavy > 0) dayScore -= outdoorHeavy * 8
        else dayScore += 6 // indoor-friendly day under rain
      }
      if ((weather.tempHighC ?? 0) >= 35 || (weather.tempLowC ?? 99) <= 0) dayScore -= 6
    }
    total += clamp(dayScore, 0, 100)
  }
  return Math.round(total / plan.dailyItinerary.length)
}

function scoreBudget(plan: TripPlan, requirements: TripRequirements): number {
  const budget = requirements.budgetAmount
  if (budget == null || budget <= 0) {
    return requirements.budgetFlexible ? 78 : 55
  }
  const total = plan.estimatedBudget.amount
  const ratio = total / budget
  if (ratio <= 0.75) return 95
  if (ratio <= 1) return 85
  if (ratio <= 1.15) return 60
  if (ratio <= 1.4) return 35
  return 15
}

function scoreComfort(plan: TripPlan, flightScore: number, hotelScore: number): number {
  let score = (flightScore * 0.45) + (hotelScore * 0.55)
  const flight = plan.flights[0]
  if (flight?.stops === 0) score += 5
  if (flight?.stops != null && flight.stops >= 2) score -= 8
  const hotel = plan.accommodations[0]
  if (hotel && /boutique|resort/i.test(hotel.category)) score += 4
  return clamp(score, 0, 100)
}

function scoreTimeEfficiency(plan: TripPlan, mapsDurationMinutes: number | null): number {
  let score = 72
  const flight = plan.flights[0]
  if (flight?.stops === 0) score += 12
  else if (flight?.stops != null && flight.stops >= 2) score -= 15

  if (mapsDurationMinutes != null) {
    if (mapsDurationMinutes <= 45) score += 10
    else if (mapsDurationMinutes <= 90) score += 4
    else if (mapsDurationMinutes > 180) score -= 12
  }

  // Crowded day activities harm efficiency
  for (const day of plan.dailyItinerary) {
    if (day.activities.length > 6) score -= 6
  }
  return clamp(score, 0, 100)
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
