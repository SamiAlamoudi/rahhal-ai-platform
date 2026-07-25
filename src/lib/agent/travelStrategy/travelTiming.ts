/**
 * Evolution Sprint 8 — timing, duration, flights, hotels, route, city-split, risk.
 */

import { clampScore, type TravelStrategyContext } from './strategyTypes'
import { evaluateSeasonStrategy, evaluateVisaTiming } from './seasonStrategy'

export function evaluateTravelTiming(ctx: TravelStrategyContext): {
  goNowOrLater: 'now' | 'later' | 'either' | 'unknown'
  notes: string[]
  timeScore: number
} {
  const season = evaluateSeasonStrategy(ctx)
  const visa = evaluateVisaTiming(ctx)
  let go = season.goNowOrLater
  const notes = [...season.notes, ...visa.notes]
  if (visa.preferLater && go === 'now') {
    go = 'later'
    notes.push('Visa processing buffer outweighs "go now" seasonal fit.')
  }
  const timeScore = clampScore((season.weatherScore + season.crowdScore + visa.score) / 3)
  return { goNowOrLater: go, notes, timeScore }
}

export function optimizeStayDuration(ctx: TravelStrategyContext): {
  stayDurationDays: number | null
  notes: string[]
  missing: string[]
  timeScore: number
} {
  const missing: string[] = []
  const recommended = ctx.destinationPriors?.recommendedStayDays
  const known = ctx.durationDays
  if (typeof known !== 'number' && !recommended) {
    missing.push('duration_days')
    return {
      stayDurationDays: null,
      notes: ['Stay duration unknown — cannot optimize nights.'],
      missing,
      timeScore: 45,
    }
  }
  if (typeof known === 'number' && recommended) {
    const notes: string[] = []
    let stay = known
    let timeScore = 70
    if (known < recommended.min) {
      stay = recommended.min
      notes.push(
        `Known ${known} days is below recommended minimum ${recommended.min} — consider extending.`,
      )
      timeScore = 40
    } else if (known > recommended.max) {
      stay = recommended.ideal
      notes.push(
        `Known ${known} days exceeds typical max ${recommended.max} — ideal near ${recommended.ideal}.`,
      )
      timeScore = 55
    } else {
      notes.push(`Duration ${known} days fits recommended band (${recommended.min}–${recommended.max}).`)
      timeScore = 80
    }
    return { stayDurationDays: stay, notes, missing, timeScore }
  }
  if (typeof known === 'number') {
    return {
      stayDurationDays: known,
      notes: [`Using stated duration ${known} days (no recommended band supplied).`],
      missing: recommended ? [] : ['recommended_stay_band'],
      timeScore: 60,
    }
  }
  return {
    stayDurationDays: recommended!.ideal,
    notes: [`No stated duration — ideal prior ${recommended!.ideal} days (not a booking).`],
    missing: ['duration_days'],
    timeScore: 55,
  }
}

export function evaluateFlightTiming(ctx: TravelStrategyContext): {
  adjustFlights: boolean | null
  convenience: number
  notes: string[]
  missing: string[]
} {
  const missing = ['flight_options']
  const notes = [
    'No live flight inventory — flight timing is strategic only.',
  ]
  if (ctx.travelerHints?.preferLowFriction || ctx.pace === 'relaxed') {
    notes.push('Prefer fewer connections / daytime arrivals when options appear later.')
    return { adjustFlights: true, convenience: 70, notes, missing }
  }
  if (ctx.budgetStance === 'strict') {
    notes.push('Strict budget may accept longer connections — confirm traveler tolerance.')
    return { adjustFlights: null, convenience: 50, notes, missing }
  }
  return { adjustFlights: null, convenience: 55, notes, missing }
}

export function evaluateHotelTiming(ctx: TravelStrategyContext): {
  notes: string[]
  comfort: number
  missing: string[]
} {
  return {
    notes: [
      'No live hotel inventory — hotel value is strategic (location/flexibility vs rate).',
      ctx.travelerHints?.preferComfort
        ? 'Bias toward cancelable / better-located stays if budget allows.'
        : 'Keep lodging flexible until dates firm.',
    ],
    comfort: ctx.travelerHints?.preferComfort ? 75 : 55,
    missing: ['hotel_options'],
  }
}

export function evaluateCitySplit(ctx: TravelStrategyContext): {
  splitItinerary: boolean | null
  notes: string[]
  flexibility: number
} {
  const duration = ctx.durationDays
  const notes: string[] = []
  if (typeof duration !== 'number') {
    return {
      splitItinerary: null,
      notes: ['Duration unknown — city-split decision deferred.'],
      flexibility: 50,
    }
  }
  if (duration >= 10 && (ctx.pace === 'packed' || ctx.purpose === 'cultural')) {
    notes.push('Longer cultural trips may gain value from a controlled two-base split.')
    return { splitItinerary: true, notes, flexibility: 70 }
  }
  if (duration <= 5) {
    notes.push('Short trips usually lose value when split across cities.')
    return { splitItinerary: false, notes, flexibility: 60 }
  }
  notes.push('Single-base stay is the default unless traveler requests a split.')
  return { splitItinerary: false, notes, flexibility: 55 }
}

export function evaluateRouteOptimizer(ctx: TravelStrategyContext): {
  transportation: number
  notes: string[]
} {
  const t = ctx.destinationPriors?.transportationQuality
  const w = ctx.destinationPriors?.walkingScore
  const notes: string[] = []
  let transportation = 55
  if (typeof t === 'number') {
    transportation = t
    notes.push(`Transit quality prior ${t}/100 informs route efficiency.`)
  } else {
    notes.push('Transit quality prior missing — route efficiency provisional.')
  }
  if (typeof w === 'number' && w < 50) {
    notes.push('Low walking score — minimize long transfers on foot; plan paid transfers.')
    transportation = Math.min(transportation, 60)
  }
  return { transportation: clampScore(transportation), notes }
}

export function evaluateTravelRisk(ctx: TravelStrategyContext): {
  riskNotes: string[]
  riskPenalty: number
  lowestRiskLean: boolean
} {
  const notes: string[] = []
  let penalty = 0
  const safety = ctx.destinationPriors?.safetyBand
  if (ctx.riskTolerance === 'low') {
    notes.push('Low risk tolerance — prefer stable timing, refundable options, fewer transfers.')
    penalty += 5
  }
  if (safety === 'caution') {
    notes.push('Safety band caution — raise contingency and avoid peak-chaos timing.')
    penalty += 15
  }
  if (safety === 'high') {
    notes.push('High safety band supports a lower-risk strategy.')
  }
  if (!safety) notes.push('Safety band unknown — risk strategy incomplete.')
  return {
    riskNotes: notes,
    riskPenalty: penalty,
    lowestRiskLean: ctx.riskTolerance === 'low' || safety === 'caution',
  }
}

export const TravelTiming = { evaluate: evaluateTravelTiming }
export const StayDurationOptimizer = { optimize: optimizeStayDuration }
export const FlightTimingStrategy = { evaluate: evaluateFlightTiming }
export const HotelTimingStrategy = { evaluate: evaluateHotelTiming }
export const CitySplitStrategy = { evaluate: evaluateCitySplit }
export const RouteOptimizer = { evaluate: evaluateRouteOptimizer }
export const TravelRiskStrategy = { evaluate: evaluateTravelRisk }
