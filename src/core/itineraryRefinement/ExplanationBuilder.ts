/**
 * Sprint 84 — explain what changed, why, impact, tradeoffs, confidence.
 */

import type { RefinementChangeKind } from './RefinementPlanner'
import type { RefinementConflict } from './ConflictDetector'
import type { RefinementAlternative } from './AlternativeGenerator'
import type { RefinementRisk } from './RiskAnalyzer'

export interface RefinementExplanation {
  whatChanged: string[]
  why: string[]
  impact: string[]
  tradeoffs: string[]
  confidence: number
  summary: string
}

const CHANGE_WHY: Partial<Record<RefinementChangeKind, string>> = {
  budget_change: 'Traveler adjusted budget constraints',
  extra_day: 'Trip length increased by one day',
  extra_traveler: 'Party size increased',
  child_traveler: 'Family / children requirements applied',
  luxury_upgrade: 'Luxury preference raised hotel/flight standards',
  economy_downgrade: 'Cost-saving preference applied',
  activity_add: 'New activity requested',
  activity_remove: 'Activity removed per request',
  weather_change: 'Weather-sensitive plan adjustment',
  flight_change: 'Flight preferences updated',
  hotel_replacement: 'Hotel replacement requested',
  meeting_insertion: 'Business meeting inserted into schedule',
  late_arrival: 'Late arrival constraints applied',
  early_departure: 'Early departure constraints applied',
  restaurant_replacement: 'Dining preference updated',
  accessibility: 'Accessibility requirements applied',
  no_early_flights: 'Early flights avoided',
  halal_food: 'Halal dining preference applied',
  transfer_optimization: 'Airport transfer aligned to flights',
  generic: 'Conversation change refined the package',
}

export function buildRefinementExplanation(input: {
  changes: RefinementChangeKind[]
  impactedComponents: string[]
  reusedComponents: string[]
  conflicts: RefinementConflict[]
  alternatives: RefinementAlternative[]
  risk: RefinementRisk
  confidence: number
  costBefore: number
  costAfter: number
  currency: string
}): RefinementExplanation {
  const whatChanged = input.changes.map((c) => c.replace(/_/g, ' '))
  if (input.impactedComponents.length) {
    whatChanged.push(`Updated ${input.impactedComponents.length} component(s)`)
  }
  whatChanged.push(`Reused ${input.reusedComponents.length} untouched component(s)`)

  const why = input.changes.map((c) => CHANGE_WHY[c] ?? 'Refinement requested')
  const impact: string[] = []
  const delta = input.costAfter - input.costBefore
  if (delta !== 0) {
    impact.push(
      `Package cost ${delta > 0 ? 'increased' : 'decreased'} by ${input.currency} ${Math.abs(Math.round(delta))}`,
    )
  } else {
    impact.push('Package cost unchanged')
  }
  if (input.conflicts.length) {
    impact.push(`${input.conflicts.length} conflict(s) detected`)
  }
  if (input.alternatives.length) {
    impact.push(`${input.alternatives.length} alternative option(s) generated`)
  }
  impact.push(`Risk level: ${input.risk.level}`)

  const tradeoffs: string[] = []
  if (input.changes.includes('luxury_upgrade')) tradeoffs.push('Higher comfort vs higher cost')
  if (input.changes.includes('economy_downgrade')) tradeoffs.push('Lower cost vs reduced comfort')
  if (input.changes.includes('extra_day')) tradeoffs.push('More time vs extra hotel night')
  if (input.changes.includes('activity_remove')) tradeoffs.push('Simpler schedule vs fewer experiences')
  if (input.alternatives.length) tradeoffs.push('See options A/B/C for alternate tradeoffs')
  if (tradeoffs.length === 0) tradeoffs.push('Minimal tradeoffs — incremental reuse prioritized')

  const summary = [
    `Refined itinerary (${input.changes.join(', ') || 'minor updates'}).`,
    why[0] ?? '',
    `Confidence ${Math.round(input.confidence * 100)}%.`,
  ].filter(Boolean).join(' ')

  return {
    whatChanged,
    why,
    impact,
    tradeoffs,
    confidence: input.confidence,
    summary,
  }
}
