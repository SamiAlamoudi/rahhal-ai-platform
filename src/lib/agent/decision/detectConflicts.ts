import type { TripPlan, TripRequirements } from '../types'
import type { DecisionConflict } from './types'

/**
 * Detect schedule / weather / budget conflicts and suggest fixes.
 * Provider-blind — only looks at TripPlan + requirements.
 */
export function detectTripConflicts(
  plan: TripPlan,
  requirements: TripRequirements,
): DecisionConflict[] {
  const conflicts: DecisionConflict[] = []

  // Budget overrun
  if (requirements.budgetAmount != null && requirements.budgetAmount > 0) {
    if (plan.estimatedBudget.amount > requirements.budgetAmount * 1.1) {
      conflicts.push({
        code: 'budget_overrun',
        severity: 'warning',
        message: `Estimated ${plan.estimatedBudget.amount} ${plan.estimatedBudget.currency} exceeds budget ${requirements.budgetAmount}`,
        suggestion: 'Swap to a cheaper hotel area or a flight with one stop to recover budget headroom',
      })
    }
  }

  // Impossible / overcrowded days
  for (const day of plan.dailyItinerary) {
    if (day.activities.length > 6) {
      conflicts.push({
        code: 'impossible_schedule',
        severity: 'critical',
        message: `Day ${day.day} packs ${day.activities.length} activities — likely unrealistic`,
        suggestion: `Move 1–2 activities from day ${day.day} to a quieter day or drop the lowest-priority stop`,
      })
    }
  }

  // Bad-weather outdoor activities
  for (const day of plan.dailyItinerary) {
    const weather = day.weather
    if (!weather) continue
    const rainy = weather.condition === 'rain' || weather.condition === 'thunderstorm'
      || (weather.rainProbability != null && weather.rainProbability >= 0.5)
    if (!rainy) continue
    const outdoor = day.activities.filter((a) =>
      /park|hike|beach|outdoor|walk|garden|cruise|market stroll/i.test(`${a.title} ${a.description ?? ''}`))
    if (outdoor.length) {
      conflicts.push({
        code: 'weather_outdoor_conflict',
        severity: 'warning',
        message: `Day ${day.day} keeps outdoor plans (${outdoor[0].title}) despite rain risk`,
        suggestion: 'Prefer indoor museums/cafés for that window, or shift the outdoor block',
      })
    }
  }

  // Extreme temperature
  for (const day of plan.dailyItinerary) {
    if ((day.weather?.tempHighC ?? 0) >= 36) {
      conflicts.push({
        code: 'extreme_heat',
        severity: 'warning',
        message: `Day ${day.day} peaks near ${day.weather?.tempHighC}°C`,
        suggestion: 'Sightsee early morning / late afternoon; keep midday indoor',
      })
    }
    if ((day.weather?.tempLowC ?? 99) <= 0) {
      conflicts.push({
        code: 'extreme_cold',
        severity: 'info',
        message: `Day ${day.day} has near-freezing lows`,
        suggestion: 'Shorten early outdoor walks and pack warm layers',
      })
    }
  }

  // Multi-city without enough days
  if (plan.destinations.length >= 3 && plan.durationDays <= 3) {
    conflicts.push({
      code: 'overambitious_routing',
      severity: 'warning',
      message: `${plan.destinations.length} destinations in ${plan.durationDays} days leaves little time on the ground`,
      suggestion: 'Drop one city hub or add nights to protect itinerary quality',
    })
  }

  // Hotel far from first attraction (heuristic via area string mismatch)
  const hotel = plan.accommodations[0]
  const attraction = plan.attractions[0]
  if (hotel?.area && attraction?.title) {
    const hub = plan.dailyItinerary[0]?.location
    if (hub && hotel.area && !looseMatch(hotel.area, hub) && plan.destinations.length === 1) {
      // soft info only when areas clearly diverge
      if (!looseMatch(hotel.area, attraction.title) && hotel.area.length > 2) {
        conflicts.push({
          code: 'hotel_attraction_distance',
          severity: 'info',
          message: `Hotel area (${hotel.area}) may be away from opening attractions`,
          suggestion: 'Prefer a stay near your first walking cluster to cut transfer time',
        })
      }
    }
  }

  return conflicts
}

function looseMatch(a: string, b: string): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  return left.includes(right.slice(0, 4)) || right.includes(left.slice(0, 4))
}
