import { MOCK_DESTINATION_META } from '../travel/mockCatalog'
import type { TravelDraft, TripGoal } from '../travel/types'

export type ReasonerFinding = {
  topic:
    | 'feasibility'
    | 'connections'
    | 'budget'
    | 'season'
    | 'weather'
    | 'holidays'
    | 'family_suitability'
    | 'business_suitability'
  ok: boolean
  score: number
  note: string
}

export type ReasonerReport = {
  overallFeasible: boolean
  findings: ReasonerFinding[]
}

function destKey(destination?: string): string | null {
  if (!destination) return null
  return destination.trim().toLowerCase()
}

/**
 * Rule-based travel reasoning over mock destination knowledge — no APIs.
 */
export class TravelReasoner {
  reason(draft: TravelDraft, goal: TripGoal = draft.tripGoal ?? 'unknown'): ReasonerReport {
    const findings: ReasonerFinding[] = []
    const key = destKey(draft.destination)
    const meta = key ? MOCK_DESTINATION_META[key] : undefined

    if (!draft.destination || !draft.origin) {
      findings.push({
        topic: 'feasibility',
        ok: false,
        score: 0.2,
        note: 'Origin and destination are required to judge feasibility.',
      })
    } else if (draft.origin.toLowerCase() === draft.destination.toLowerCase()) {
      findings.push({
        topic: 'feasibility',
        ok: false,
        score: 0,
        note: 'Origin and destination cannot be the same city.',
      })
    } else {
      findings.push({
        topic: 'feasibility',
        ok: true,
        score: 0.9,
        note: `Route ${draft.origin} → ${draft.destination} looks feasible on mock data.`,
      })
      findings.push({
        topic: 'connections',
        ok: true,
        score: 0.8,
        note: 'Direct mock options available for common Gulf–Europe/MENA routes.',
      })
    }

    if (draft.budgetAmount != null && draft.budgetAmount > 0) {
      const tight = draft.budgetAmount < 800
      findings.push({
        topic: 'budget',
        ok: !tight || (draft.durationNights ?? 3) <= 2,
        score: tight ? 0.4 : 0.85,
        note: tight
          ? 'Budget is tight for multi-night packages; prefer short hops.'
          : 'Budget band supports typical mock hotel + flight mixes.',
      })
    } else {
      findings.push({
        topic: 'budget',
        ok: true,
        score: 0.5,
        note: 'No budget set — assuming mid-range mock planning.',
      })
    }

    if (meta) {
      findings.push({
        topic: 'season',
        ok: meta.season !== 'peak' || (draft.budgetAmount ?? 0) >= 2000,
        score: meta.season === 'peak' ? 0.55 : 0.85,
        note: `Seasonality for ${draft.destination}: ${meta.season}.`,
      })
      findings.push({
        topic: 'weather',
        ok: true,
        score: 0.75,
        note: `Typical weather: ${meta.typicalWeather}.`,
      })
      if (meta.holidaysNote) {
        findings.push({
          topic: 'holidays',
          ok: true,
          score: 0.7,
          note: meta.holidaysNote,
        })
      }
      findings.push({
        topic: 'family_suitability',
        ok: goal !== 'family' || meta.familySuitability >= 0.7,
        score: meta.familySuitability,
        note: `Family suitability ${meta.familySuitability}.`,
      })
      findings.push({
        topic: 'business_suitability',
        ok: goal !== 'business' || meta.businessSuitability >= 0.7,
        score: meta.businessSuitability,
        note: `Business suitability ${meta.businessSuitability}.`,
      })
    } else if (draft.destination) {
      findings.push({
        topic: 'season',
        ok: true,
        score: 0.5,
        note: 'Destination not in mock knowledge — neutral season assumption.',
      })
    }

    const overallFeasible = findings.filter((f) => f.topic === 'feasibility').every((f) => f.ok)
    return { overallFeasible, findings }
  }
}
