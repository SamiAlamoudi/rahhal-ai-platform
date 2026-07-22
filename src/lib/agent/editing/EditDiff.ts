/**
 * Sprint 118 — EditDiff
 */

import type { EditPlan } from './EditPlanner'
import type { EditSnapshot } from './EditAnalyzer'
import type { PipelineResult } from '../pipeline'

export interface EditDiff {
  before: {
    trip: EditSnapshot['trip']
    budget: number | null
    confidence: number
    flightCount: number
    hotelCount: number
    cities: string[]
  }
  after: {
    trip: EditSnapshot['trip']
    budget: number | null
    confidence: number
    flightCount: number
    hotelCount: number
    cities: string[]
  }
  changes: string[]
  confidenceDelta: number
  budgetDelta: number | null
  timeDeltaMs: number
}

export function buildEditDiff(input: {
  plan: EditPlan
  snapshot: EditSnapshot
  afterResult: PipelineResult | null
  executionTimeMs: number
}): EditDiff {
  const beforeBudget =
    input.snapshot.budget
    ?? input.snapshot.trip.budget
    ?? null
  const afterBudget =
    input.plan.afterTrip.budget
    ?? input.plan.analyzed.budgetValue
    ?? beforeBudget
  const afterConfidence =
    input.afterResult?.confidence
    ?? input.snapshot.confidence
  const citiesBefore = input.snapshot.cities?.slice() ?? []
  const citiesAfter = citiesBefore
    .filter(
      (c) =>
        !input.plan.analyzed.removedCities.some(
          (r) => r.toLowerCase() === c.toLowerCase(),
        ),
    )
    .concat(input.plan.analyzed.addedCities)

  return {
    before: {
      trip: input.plan.beforeTrip,
      budget: beforeBudget,
      confidence: input.snapshot.confidence,
      flightCount: input.snapshot.flights.length,
      hotelCount: input.snapshot.hotels.length,
      cities: citiesBefore,
    },
    after: {
      trip: input.plan.afterTrip,
      budget: afterBudget,
      confidence: afterConfidence,
      flightCount: input.afterResult?.flightOffers.length
        ?? input.snapshot.flights.length,
      hotelCount: input.afterResult?.hotelOffers.length
        ?? input.snapshot.hotels.length,
      cities: citiesAfter,
    },
    changes: input.plan.whatChanged.slice(),
    confidenceDelta:
      Math.round((afterConfidence - input.snapshot.confidence) * 1000) / 1000,
    budgetDelta:
      beforeBudget != null && afterBudget != null
        ? afterBudget - beforeBudget
        : null,
    timeDeltaMs: input.executionTimeMs,
  }
}

export class EditDiffBuilder {
  build(input: Parameters<typeof buildEditDiff>[0]): EditDiff {
    return buildEditDiff(input)
  }
}

export function createEditDiffBuilder(): EditDiffBuilder {
  return new EditDiffBuilder()
}
