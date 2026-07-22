/**
 * Sprint 97 — conversation pipeline integration for Concierge Experience.
 * Additive presentation only — engines untouched.
 */

import type { ConciergeExperienceResult } from '../../../core'
import {
  runConciergeExperience,
  toAgentConciergeExperienceMeta,
  type AgentConciergeExperienceMeta,
} from '../conciergeExperience'
import { isConciergeExperienceEnabled } from '../conciergeExperience/feature'
import type { AgentMemory } from '../types'
import { offersFromEngineSnapshots, tripFactsFromMemory } from './adapters'
import {
  toConversationResponseDto,
  toRecommendationResponseDto,
  toTripResponseDto,
} from './serializers'
import {
  emptyRecommendationResponseDto,
  SPRINT97_CONCIERGE_INTEGRATION_VERSION,
  type ConversationResponseDto,
  type RecommendationResponseDto,
  type TripResponseDto,
} from './types'

export interface ConciergeTurnIntegrationInput {
  conversationId?: string
  iteration?: number
  memory: AgentMemory
  flightOffers?: Array<Record<string, unknown>> | null
  hotelOffers?: Array<Record<string, unknown>> | null
  packageSelected?: Record<string, unknown> | null
  packageRanked?: Array<Record<string, unknown>> | null
  decision?: {
    explanation?: string | null
    confidence?: number | null
    bestOverallId?: string | null
    bestBudgetId?: string | null
    fastestId?: string | null
    bestComfortId?: string | null
  } | null
  priceTimingNote?: string | null
  priceConfidence?: number | null
  engineConfidence?: number | null
  /** Explicit override (tests). */
  enabled?: boolean
}

export interface ConciergeTurnIntegrationResult {
  enabled: boolean
  version: string
  result: ConciergeExperienceResult | null
  meta: AgentConciergeExperienceMeta | null
  recommendationFacts: string[]
  recommendation: RecommendationResponseDto
  toConversationResponse: (reply: string) => ConversationResponseDto
  toTripResponse: () => TripResponseDto
}

/**
 * Integrate ConciergeComposer into a conversation turn.
 * When flag is off → legacy-compatible empty recommendation DTO, no facts.
 */
export function integrateConciergeIntoTurn(
  input: ConciergeTurnIntegrationInput,
): ConciergeTurnIntegrationResult {
  const enabled = isConciergeExperienceEnabled({ enabled: input.enabled })
  if (!enabled) {
    const recommendation = emptyRecommendationResponseDto()
    return {
      enabled: false,
      version: SPRINT97_CONCIERGE_INTEGRATION_VERSION,
      result: null,
      meta: null,
      recommendationFacts: [],
      recommendation,
      toConversationResponse: (reply) => toConversationResponseDto({
        reply,
        result: null,
        enabled: false,
      }),
      toTripResponse: () => toTripResponseDto({
        tripId: null,
        destination: input.memory.requirements.destination,
        origin: input.memory.requirements.origin,
        startDate: input.memory.requirements.startDate,
        endDate: input.memory.requirements.endDate,
        currency: input.memory.requirements.budgetCurrency,
        result: null,
        enabled: false,
      }),
    }
  }

  const trip = tripFactsFromMemory(input.memory)
  const offers = offersFromEngineSnapshots({
    flightOffers: input.flightOffers,
    hotelOffers: input.hotelOffers,
    packageSelected: input.packageSelected,
    packageRanked: input.packageRanked,
    decision: input.decision,
    priceTimingNote: input.priceTimingNote,
    priceConfidence: input.priceConfidence,
  })

  const bridge = runConciergeExperience({
    conversationId: input.conversationId,
    iteration: input.iteration,
    memory: input.memory,
    trip,
    offers,
    engineConfidence: input.engineConfidence
      ?? input.decision?.confidence
      ?? input.priceConfidence
      ?? null,
    enabled: true,
  })

  const result = bridge.result
  const meta = bridge.meta
    ?? (result ? toAgentConciergeExperienceMeta(result) : null)
  const recommendation = toRecommendationResponseDto(result, { enabled: true })

  return {
    enabled: true,
    version: SPRINT97_CONCIERGE_INTEGRATION_VERSION,
    result,
    meta,
    recommendationFacts: bridge.recommendationFacts,
    recommendation,
    toConversationResponse: (reply) => toConversationResponseDto({
      reply,
      result,
      meta,
      enabled: true,
    }),
    toTripResponse: () => toTripResponseDto({
      tripId: result?.conversationId ?? null,
      destination: trip.destination ?? null,
      origin: trip.origin ?? null,
      startDate: trip.startDate ?? null,
      endDate: trip.endDate ?? null,
      currency: trip.currency ?? null,
      result,
      meta,
      enabled: true,
    }),
  }
}
