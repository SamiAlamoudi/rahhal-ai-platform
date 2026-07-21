/**
 * Sprint 77 — assemble Journey Score from component scores + factors.
 */

import type { ItineraryCandidate } from './candidate'
import { clampScore } from './candidate'
import { scoreBusiness } from './business'
import { scoreComfort } from './comfort'
import { scoreConvenience } from './convenience'
import { scoreFamily } from './family'
import { scoreLuxury } from './luxury'
import { scoreTravelTime } from './travelTime'
import type { ParsedOptimizerIntent } from './parseIntent'
import type {
  JourneyScoreBreakdown,
  OptimizationFactorScore,
  OptimizationPriority,
  TripOptimizerTradeoff,
} from './types'

function budgetScoreFor(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): number {
  const cap = candidate.budgetCap
  if (cap == null || cap <= 0) {
    return intent.priority === 'budget' ? 55 : 70
  }
  const ratio = candidate.totalPrice / cap
  let score = 100
  if (ratio <= 0.55) score = 92
  else if (ratio <= 0.75) score = 85
  else if (ratio <= 0.9) score = 78
  else if (ratio <= 1) score = 68
  else if (ratio <= 1.15) score = 40
  else score = 18

  if (intent.willingToPayMore && ratio <= 1.25) score = Math.max(score, 65)
  if (intent.priority === 'budget' && ratio > 1) score -= 15
  return clampScore(score)
}

function weatherFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const fit = candidate.weatherFit ?? 70
  return { name: 'weather_compatibility', score: clampScore(fit), weight: 0.04 }
}

function riskFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  // Lower risk score value means safer; convert to quality score.
  const risk = candidate.riskHint ?? 20
  const quality = clampScore(100 - risk)
  return { name: 'risk_score', score: quality, weight: 0.05, note: `risk=${risk}` }
}

function layoverFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const layover = candidate.flight.layoverMinutes
  let score = 80
  if (layover == null || layover === 0) score = candidate.flight.stops === 0 ? 95 : 70
  else if (layover < 60) score = 35
  else if (layover <= 150) score = 88
  else if (layover <= 240) score = 60
  else score = 30
  return { name: 'layover_quality', score, weight: 0.06 }
}

function transferFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const walk = candidate.hotel.walkMinutes
  let score = 70
  if (walk != null) {
    if (walk <= 10) score = 92
    else if (walk <= 20) score = 80
    else if (walk <= 35) score = 62
    else score = 38
  }
  return { name: 'airport_transfer', score, weight: 0.05 }
}

function sleepFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const arrival = candidate.flight.arrivalHour
  let score = 70
  if (arrival != null) {
    if (arrival >= 10 && arrival <= 18) score = 90
    else if (arrival >= 19 && arrival <= 21) score = 72
    else score = 40
  }
  if ((candidate.hotel.stars ?? 0) >= 4) score += 5
  return { name: 'sleep_quality', score: clampScore(score), weight: 0.06 }
}

function jetLagFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const duration = candidate.flight.durationMinutes ?? 0
  const arrival = candidate.flight.arrivalHour
  let score = 85
  if (duration >= 600) {
    score = 55
    if (arrival != null && (arrival <= 6 || arrival >= 22)) score = 35
    else if (arrival != null && arrival >= 9 && arrival <= 15) score = 65
  }
  return { name: 'jet_lag_impact', score, weight: 0.05 }
}

function checkInFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const arrival = candidate.flight.arrivalHour
  const checkIn = candidate.hotel.checkInHour ?? 15
  let score = 70
  if (arrival != null) {
    if (arrival >= checkIn) score = 90
    else if (arrival >= checkIn - 2) score = 65
    else score = 35
  }
  return { name: 'checkin_compatibility', score, weight: 0.05 }
}

function checkOutFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const departure = candidate.flight.departureHour
  const checkOut = candidate.hotel.checkOutHour ?? 12
  let score = 75
  if (departure != null) {
    if (departure >= checkOut + 2) score = 88
    else if (departure >= checkOut) score = 70
    else score = 42
  }
  return { name: 'checkout_compatibility', score, weight: 0.04 }
}

function walkingFactor(candidate: ItineraryCandidate, intent: ParsedOptimizerIntent): OptimizationFactorScore {
  const walk = candidate.hotel.walkMinutes
  let score = 70
  if (walk != null) {
    if (walk <= 8) score = 95
    else if (walk <= 15) score = 85
    else if (walk <= 25) score = 68
    else score = 40
  }
  if (intent.minWalking && score < 70) score -= 10
  return { name: 'walking_distance', score: clampScore(score), weight: 0.05 }
}

function preferenceFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const boost = candidate.personalizationBoost
  return {
    name: 'traveler_preferences',
    score: clampScore(50 + boost),
    weight: 0.08,
    note: `boost=${boost}`,
  }
}

function remainingBudgetFactor(candidate: ItineraryCandidate): OptimizationFactorScore {
  const remaining = candidate.remainingBudget
  if (remaining == null) {
    return { name: 'budget_remaining', score: 70, weight: 0.07 }
  }
  let score = 70
  if (remaining >= 0) {
    const ratio = candidate.budgetCap && candidate.budgetCap > 0
      ? remaining / candidate.budgetCap
      : 0.2
    score = clampScore(60 + ratio * 40)
  } else {
    score = clampScore(30 + remaining / 100) // overflow penalty
  }
  return { name: 'budget_remaining', score, weight: 0.07 }
}

const PRIORITY_WEIGHTS: Record<OptimizationPriority, Partial<Record<keyof JourneyScoreBreakdown, number>>> = {
  balanced: {
    comfortScore: 0.14,
    convenienceScore: 0.14,
    budgetScore: 0.16,
    travelTimeScore: 0.14,
    businessScore: 0.1,
    familyScore: 0.1,
    luxuryScore: 0.08,
  },
  comfort: {
    comfortScore: 0.28,
    convenienceScore: 0.14,
    travelTimeScore: 0.12,
    budgetScore: 0.1,
    luxuryScore: 0.12,
  },
  convenience: {
    convenienceScore: 0.28,
    travelTimeScore: 0.16,
    comfortScore: 0.12,
    budgetScore: 0.12,
  },
  value: {
    budgetScore: 0.28,
    convenienceScore: 0.14,
    comfortScore: 0.12,
    travelTimeScore: 0.12,
  },
  speed: {
    travelTimeScore: 0.34,
    convenienceScore: 0.16,
    budgetScore: 0.12,
    comfortScore: 0.1,
  },
  luxury: {
    luxuryScore: 0.3,
    comfortScore: 0.2,
    budgetScore: 0.08,
    convenienceScore: 0.12,
  },
  business: {
    businessScore: 0.3,
    travelTimeScore: 0.18,
    convenienceScore: 0.16,
    comfortScore: 0.12,
  },
  family: {
    familyScore: 0.3,
    comfortScore: 0.16,
    convenienceScore: 0.14,
    travelTimeScore: 0.12,
    budgetScore: 0.1,
  },
  budget: {
    budgetScore: 0.34,
    travelTimeScore: 0.14,
    convenienceScore: 0.12,
    comfortScore: 0.1,
  },
}

export function collectOptimizationFactors(
  candidate: ItineraryCandidate,
  intent: ParsedOptimizerIntent,
): OptimizationFactorScore[] {
  return [
    { name: 'flight', score: clampScore(55 + (candidate.flight.stops === 0 ? 20 : -8) + (candidate.flight.cabin === 'business' ? 15 : 0)), weight: 0.08 },
    { name: 'hotel', score: clampScore(40 + (candidate.hotel.stars ?? 3) * 12), weight: 0.08 },
    transferFactor(candidate),
    layoverFactor(candidate),
    {
      name: 'arrival_time',
      score: clampScore(
        candidate.flight.arrivalHour == null
          ? 70
          : candidate.flight.arrivalHour >= 9 && candidate.flight.arrivalHour <= 18
            ? 88
            : candidate.flight.arrivalHour >= 22 || candidate.flight.arrivalHour <= 5
              ? 35
              : 60,
      ),
      weight: 0.05,
    },
    {
      name: 'departure_time',
      score: clampScore(
        candidate.flight.departureHour == null
          ? 70
          : candidate.flight.departureHour >= 8 && candidate.flight.departureHour <= 11
            ? 85
            : candidate.flight.departureHour <= 6
              ? 45
              : 70,
      ),
      weight: 0.04,
    },
    checkInFactor(candidate),
    checkOutFactor(candidate),
    {
      name: 'total_travel_duration',
      score: scoreTravelTime(candidate, intent),
      weight: 0.07,
    },
    sleepFactor(candidate),
    jetLagFactor(candidate),
    remainingBudgetFactor(candidate),
    preferenceFactor(candidate),
    {
      name: 'family_friendliness',
      score: scoreFamily(candidate, intent),
      weight: 0.05,
    },
    {
      name: 'business_suitability',
      score: scoreBusiness(candidate, intent),
      weight: 0.05,
    },
    {
      name: 'luxury_score',
      score: scoreLuxury(candidate, intent),
      weight: 0.05,
    },
    walkingFactor(candidate, intent),
    weatherFactor(candidate),
    riskFactor(candidate),
  ]
}

export function buildTradeoffs(
  candidate: ItineraryCandidate,
  scores: JourneyScoreBreakdown,
): TripOptimizerTradeoff[] {
  const tradeoffs: TripOptimizerTradeoff[] = []
  if (candidate.budgetCap != null && candidate.totalPrice > candidate.budgetCap) {
    tradeoffs.push({
      kind: 'budget_overflow',
      description: `Total ${candidate.totalPrice} exceeds budget ${candidate.budgetCap}`,
      severity: 'high',
    })
  }
  if ((candidate.flight.layoverMinutes ?? 0) > 240) {
    tradeoffs.push({
      kind: 'long_layover',
      description: `Long layover (~${candidate.flight.layoverMinutes} min)`,
      severity: 'medium',
    })
  }
  const arrival = candidate.flight.arrivalHour
  if (arrival != null && (arrival >= 22 || arrival <= 5)) {
    tradeoffs.push({
      kind: 'late_arrival',
      description: `Late/early arrival at hour ${arrival}`,
      severity: 'medium',
    })
  }
  const checkIn = candidate.hotel.checkInHour ?? 15
  if (arrival != null && arrival < checkIn - 2) {
    tradeoffs.push({
      kind: 'hotel_mismatch',
      description: `Arrival ${arrival}:00 before typical check-in ${checkIn}:00`,
      severity: 'medium',
    })
  }
  if (scores.luxuryScore >= 80 && scores.budgetScore <= 45) {
    tradeoffs.push({
      kind: 'luxury_vs_budget',
      description: 'High luxury fit with weak budget fit',
      severity: 'low',
    })
  }
  if (candidate.personalizationBoost < -10) {
    tradeoffs.push({
      kind: 'preference_conflict',
      description: 'Conflicts with traveler preferences',
      severity: 'medium',
    })
  }
  return tradeoffs
}

export function computeJourneyScores(
  candidate: ItineraryCandidate,
  intent: ParsedOptimizerIntent,
): {
  scores: JourneyScoreBreakdown
  factors: OptimizationFactorScore[]
  tradeoffs: TripOptimizerTradeoff[]
} {
  const comfortScore = scoreComfort(candidate, intent)
  const convenienceScore = scoreConvenience(candidate, intent)
  const travelTimeScore = scoreTravelTime(candidate, intent)
  const familyScore = scoreFamily(candidate, intent)
  const businessScore = scoreBusiness(candidate, intent)
  const luxuryScore = scoreLuxury(candidate, intent)
  const budgetScore = budgetScoreFor(candidate, intent)

  const scores: JourneyScoreBreakdown = {
    journeyScore: 0,
    budgetScore,
    comfortScore,
    convenienceScore,
    businessScore,
    familyScore,
    luxuryScore,
    travelTimeScore,
  }

  const weights = PRIORITY_WEIGHTS[intent.priority]
  const dimensionEntries: Array<[keyof JourneyScoreBreakdown, number]> = [
    ['comfortScore', scores.comfortScore],
    ['convenienceScore', scores.convenienceScore],
    ['budgetScore', scores.budgetScore],
    ['travelTimeScore', scores.travelTimeScore],
    ['businessScore', scores.businessScore],
    ['familyScore', scores.familyScore],
    ['luxuryScore', scores.luxuryScore],
  ]

  let weighted = 0
  let weightSum = 0
  for (const [key, value] of dimensionEntries) {
    const w = weights[key] ?? 0.1
    weighted += value * w
    weightSum += w
  }

  // Blend in factor average (optimization factors) at ~25%
  const factors = collectOptimizationFactors(candidate, intent)
  const factorAvg = factors.reduce((sum, f) => sum + f.score * f.weight, 0)
    / Math.max(0.01, factors.reduce((sum, f) => sum + f.weight, 0))

  const base = weightSum > 0 ? weighted / weightSum : 50
  scores.journeyScore = clampScore(base * 0.75 + factorAvg * 0.25)

  // Soft personalization nudge on journey score
  scores.journeyScore = clampScore(scores.journeyScore + candidate.personalizationBoost * 0.15)

  return {
    scores,
    factors,
    tradeoffs: buildTradeoffs(candidate, scores),
  }
}
