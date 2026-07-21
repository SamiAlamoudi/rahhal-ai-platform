/**
 * Sprint 79 — DecisionEngine: collect → dedupe → score → rank → recommend.
 */

import { createSearchPlans, type StrategyContext } from '../searchPlanner/createSearchPlans'
import { rankCandidates, pickRecommendationBundle } from '../searchRanking/rankCandidates'
import { emitDecisionEvent } from '../observability/events'
import type {
  DecisionEngineResult,
  DecisionEvent,
  FlightCandidateFacts,
  HotelCandidateFacts,
  RecommendationBundle,
} from '../types'
import { SPRINT79_DECISION_ENGINE_VERSION } from '../types'
import { dedupeCandidates } from './dedupe'
import { buildDecisionReasons, formatExplanation } from './explain'
import { executeSearchPlansParallel } from './executePlans'
import { normalizeFlight, normalizeHotel } from './normalize'

export interface DecisionEngineInput {
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  strategy?: StrategyContext
  budgetCap?: number | null
  /** Optional pre-normalized facts (tests / advanced callers). */
  flights?: FlightCandidateFacts[]
  hotels?: HotelCandidateFacts[]
}

export class DecisionEngine {
  async decide(input: DecisionEngineInput): Promise<DecisionEngineResult> {
    const started = Date.now()
    const events: DecisionEvent[] = []

    const flights = input.flights
      ?? (input.flightOffers ?? []).map((o, i) => normalizeFlight(o, i))
    const hotels = input.hotels
      ?? (input.hotelStays ?? []).map((s, i) => normalizeHotel(s, i))

    const plans = createSearchPlans(input.strategy ?? {}, events)

    if (flights.length === 0 || hotels.length === 0) {
      const empty: RecommendationBundle = {
        bestOverall: null,
        bestBudget: null,
        fastest: null,
        bestComfort: null,
        bestFamily: null,
        explanation: 'No flight/hotel candidates available to decide.',
        confidence: 0,
        ranked: [],
      }
      return {
        version: SPRINT79_DECISION_ENGINE_VERSION,
        plans,
        candidates: [],
        recommendations: empty,
        events,
        durationMs: Date.now() - started,
        duplicateCount: 0,
        fallbackUsed: true,
      }
    }

    const executed = await executeSearchPlansParallel({
      plans,
      flights,
      hotels,
      budgetCap: input.budgetCap ?? input.strategy?.budgetAmount ?? null,
      events,
    })

    const { unique, duplicateCount } = dedupeCandidates(executed.candidates)
    const { ranked } = rankCandidates(unique)
    const picks = pickRecommendationBundle(ranked)
    const selected = picks.bestOverall

    let explanation = 'No recommendation available.'
    let confidence = 0
    if (selected) {
      const reasons = buildDecisionReasons(selected, ranked)
      selected.reasons = reasons
      confidence = Math.round(
        ((selected.score?.confidence ?? 70) + (selected.score?.overall ?? 0)) / 2,
      )
      explanation = formatExplanation(selected, reasons, confidence)
      emitDecisionEvent('candidate.selected', {
        candidateId: selected.id,
        score: selected.score?.overall ?? null,
        confidence,
        labels: selected.labels,
      }, events)
    }

    const recommendations: RecommendationBundle = {
      ...picks,
      explanation,
      confidence,
      ranked,
    }

    return {
      version: SPRINT79_DECISION_ENGINE_VERSION,
      plans,
      candidates: ranked,
      recommendations,
      events,
      durationMs: Date.now() - started,
      duplicateCount,
      fallbackUsed: executed.fallbackUsed,
    }
  }
}

export function createDecisionEngine(): DecisionEngine {
  return new DecisionEngine()
}

export async function runDecisionEngine(
  input: DecisionEngineInput,
): Promise<DecisionEngineResult> {
  return createDecisionEngine().decide(input)
}
