/**
 * Integration Sprint 12 — shared decision engine across modules.
 * Considers budget, timeline, flights, hotels, maps, risk, preference.
 */

import { computeTripScores, scoreFlightCandidate, scoreHotelCandidate } from '../decision'
import type { AgentMemory, TripPlan } from '../types'
import type { JourneyHandoffContext, JourneySharedDecision } from './types'

export function scoreSharedJourneyDecision(input: {
  memory: AgentMemory
  plan?: TripPlan | null
  handoff: JourneyHandoffContext
  mapsMinutes?: number | null
  riskHint?: number | null
}): JourneySharedDecision {
  const plan = input.plan ?? input.memory.tripPlan
  const requirements = input.memory.requirements
  const budget = typeof requirements.budgetAmount === 'number' ? requirements.budgetAmount : null

  let flightScore = 55
  let hotelScore = 55
  if (plan?.flights[0]) {
    const f = plan.flights[0]
    flightScore = scoreFlightCandidate(
      {
        price: f.estimatedCost,
        stops: f.stops,
        airline: f.airline,
      },
      0,
      budget,
    ).score
  }
  if (plan?.accommodations[0]) {
    const h = plan.accommodations[0]
    hotelScore = scoreHotelCandidate(
      {
        estimatedNightly: h.estimatedNightly,
        area: h.area,
      },
      0,
      [],
      budget != null && (requirements.durationDays ?? 1) > 0
        ? Math.round(budget / Math.max(1, (requirements.durationDays ?? 1) - 1 || 1))
        : null,
    ).score
  }

  if (!plan) {
    const preference = preferenceScore(input.handoff)
    const budgetScore = input.handoff.budgetAmount != null ? 70 : 45
    const overall = Math.round((preference + budgetScore) / 2)
    return {
      overall,
      budget: budgetScore,
      timeline: 50,
      flights: flightScore,
      hotels: hotelScore,
      maps: 50,
      risk: input.riskHint ?? 40,
      preference,
      rationaleEn: 'Shared decision from traveler context (plan still forming).',
      rationaleAr: 'قرار مشترك من سياق المسافر (الخطة ما زالت تتشكل).',
    }
  }

  const scores = computeTripScores({
    plan,
    requirements,
    flightScore,
    hotelScore,
    mapsDurationMinutes: input.mapsMinutes ?? null,
  })
  const preference = preferenceScore(input.handoff)
  const risk = clamp(
    input.riskHint ?? (input.handoff.scenario === 'disruption_recovery' ? 75 : 35),
    0,
    100,
  )
  const maps = scores.timeEfficiency
  const overall = Math.round(
    scores.overall * 0.55
    + preference * 0.15
    + maps * 0.1
    + (100 - risk) * 0.1
    + scores.budget * 0.1,
  )

  return {
    overall: clamp(overall, 0, 100),
    budget: scores.budget,
    timeline: scores.timeEfficiency,
    flights: scores.flight,
    hotels: scores.hotel,
    maps,
    risk,
    preference,
    rationaleEn:
      `Shared score ${clamp(overall, 0, 100)}/100 · budget ${scores.budget}, flights ${scores.flight}, hotels ${scores.hotel}, risk ${risk}.`,
    rationaleAr:
      `درجة مشتركة ${clamp(overall, 0, 100)}/100 · ميزانية ${scores.budget}، طيران ${scores.flight}، فنادق ${scores.hotel}، مخاطر ${risk}.`,
  }
}

function preferenceScore(handoff: JourneyHandoffContext): number {
  let score = 50
  score += Math.min(30, handoff.knownSlots.length * 4)
  if (handoff.scenario === 'luxury') score += 8
  if (handoff.scenario === 'budget') score += 4
  if (handoff.scenario === 'family') score += 6
  if (handoff.scenario === 'business') score += 6
  return clamp(score, 0, 100)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
