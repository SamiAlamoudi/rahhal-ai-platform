/**
 * Sprint 93 — agent bridge for Unified Travel Intelligence.
 * Maps existing agent/package/decision outputs into TripComposer input.
 */

import {
  composeUnifiedTrip,
  SPRINT93_UNIFIED_TRIP_VERSION,
  type TripComposeRequest,
  type TripComposeResult,
  type PackageBuilderResult,
  type DecisionEngineResult,
  type BookingTimingResult,
  type RefinementResult,
} from '../../../core'
import type { AgentMemory } from '../types'
import { isUnifiedTripEnabled } from './feature'

export { SPRINT93_UNIFIED_TRIP_VERSION }

export interface AgentUnifiedTripRequest {
  conversationId?: string
  memory?: AgentMemory | null
  flightOffers?: Array<Record<string, unknown>>
  hotelOffers?: Array<Record<string, unknown>>
  packages?: PackageBuilderResult | null
  refinement?: RefinementResult | null
  decision?: DecisionEngineResult | null
  priceTiming?: BookingTimingResult | null
  enabled?: boolean
  usePlaceholders?: boolean
}

export interface AgentUnifiedTripMeta {
  version: string
  tripId: string
  valid: boolean
  total: number
  currency: string
  confidence: number
  alternativeCount: number
  timelineCount: number
  durationMs: number
}

export interface AgentUnifiedTripResponse {
  enabled: boolean
  result: TripComposeResult | null
  meta: AgentUnifiedTripMeta | null
}

function packageFromBuilder(
  packages: PackageBuilderResult | null | undefined,
  refinement: RefinementResult | null | undefined,
): TripComposeRequest['packageSelected'] {
  const selected = refinement?.refined ?? packages?.selected ?? packages?.ranked[0] ?? null
  if (!selected) return null
  return {
    id: selected.id,
    title: selected.title,
    currency: selected.currency,
    totalPrice: selected.totalPrice,
    confidence: selected.confidence,
    explanation: selected.explanation,
    components: selected.components.map((c) => ({
      kind: c.kind,
      id: c.id,
      title: c.title,
      price: c.price,
      currency: c.currency,
      payload: c.payload,
    })),
    destination: selected.destination,
    checkIn: selected.checkIn,
    checkOut: selected.checkOut,
    arrivalAt: selected.arrivalAt,
    departureAt: selected.departureAt,
    labels: selected.labels,
  }
}

function rankedFromBuilder(
  packages: PackageBuilderResult | null | undefined,
): NonNullable<TripComposeRequest['packageRanked']> {
  return (packages?.ranked ?? []).map((selected) => ({
    id: selected.id,
    title: selected.title,
    currency: selected.currency,
    totalPrice: selected.totalPrice,
    confidence: selected.confidence,
    explanation: selected.explanation,
    components: selected.components.map((c) => ({
      kind: c.kind,
      id: c.id,
      title: c.title,
      price: c.price,
      currency: c.currency,
      payload: c.payload,
    })),
    destination: selected.destination,
    checkIn: selected.checkIn,
    checkOut: selected.checkOut,
    arrivalAt: selected.arrivalAt,
    departureAt: selected.departureAt,
    labels: selected.labels,
  }))
}

export function toAgentUnifiedTripMeta(result: TripComposeResult): AgentUnifiedTripMeta {
  return {
    version: result.version,
    tripId: result.trip.id,
    valid: result.trip.valid,
    total: result.trip.pricingSummary.total,
    currency: result.trip.currency,
    confidence: result.trip.confidence.overall,
    alternativeCount: result.trip.alternatives.length,
    timelineCount: result.trip.timeline.length,
    durationMs: result.durationMs,
  }
}

/**
 * Compose one presentation-ready Trip from existing engine outputs.
 */
export function runUnifiedTrip(input: AgentUnifiedTripRequest): AgentUnifiedTripResponse {
  if (!isUnifiedTripEnabled({ enabled: input.enabled })) {
    return { enabled: false, result: null, meta: null }
  }

  const req = input.memory?.requirements
  const packageSelected = packageFromBuilder(input.packages, input.refinement)
  const result = composeUnifiedTrip({
    conversationId: input.conversationId,
    destination: req?.destination ?? packageSelected?.destination ?? null,
    origin: req?.origin ?? null,
    startDate: req?.startDate ?? packageSelected?.checkIn ?? null,
    endDate: req?.endDate ?? packageSelected?.checkOut ?? null,
    durationDays: req?.durationDays ?? null,
    adults: req?.travelers ?? 1,
    children: 0,
    travelerType: req?.travelerType ?? null,
    budgetCap: req?.budgetAmount ?? null,
    currency: req?.budgetCurrency ?? packageSelected?.currency ?? 'SAR',
    flightOffers: input.flightOffers,
    hotelOffers: input.hotelOffers,
    packageSelected,
    packageRanked: rankedFromBuilder(input.packages),
    decision: input.decision
      ? {
        explanation: input.decision.recommendations.explanation,
        confidence: input.decision.recommendations.confidence,
        bestOverallId: input.decision.recommendations.bestOverall?.id ?? null,
        bestBudgetId: input.decision.recommendations.bestBudget?.id ?? null,
        fastestId: input.decision.recommendations.fastest?.id ?? null,
        bestComfortId: input.decision.recommendations.bestComfort?.id ?? null,
      }
      : null,
    priceConfidence: input.priceTiming?.recommendation.confidence ?? null,
    priceTimingNote: input.priceTiming?.recommendation.reason ?? null,
    usePlaceholders: input.usePlaceholders,
  })

  return {
    enabled: true,
    result,
    meta: toAgentUnifiedTripMeta(result),
  }
}

export function enrichWithUnifiedTrip(
  input: AgentUnifiedTripRequest,
): AgentUnifiedTripResponse {
  return runUnifiedTrip(input)
}
