/**
 * Sprint 106 — ResponseComposer
 * Orchestrates mapper → alternatives → reasons → confidence → insights → summary.
 */

import {
  createAlternativeGenerator,
  type AlternativeGenerator,
} from './AlternativeGenerator'
import {
  createConfidenceExplainer,
  type ConfidenceExplainer,
} from './ConfidenceExplainer'
import {
  createResponseComposerMapper,
  isValidComposerFlight,
  normalizeComposerFlights,
  type ResponseComposerMapper,
} from './ResponseComposerMapper'
import {
  createResponseSummary,
  type ResponseSummary,
} from './ResponseSummary'
import {
  createTravelInsights,
  type TravelInsights,
} from './TravelInsights'
import type {
  ResponseComposerInput,
  ResponseComposerResult,
} from './types'
import { SPRINT106_RESPONSE_COMPOSER_VERSION } from './types'

export interface ResponseComposerOptions {
  mapper?: ResponseComposerMapper
  alternatives?: AlternativeGenerator
  confidence?: ConfidenceExplainer
  insights?: TravelInsights
  summary?: ResponseSummary
  nowMs?: () => number
}

export class ResponseComposer {
  private readonly mapper: ResponseComposerMapper
  private readonly alternatives: AlternativeGenerator
  private readonly confidence: ConfidenceExplainer
  private readonly insights: TravelInsights
  private readonly summary: ResponseSummary
  private readonly nowMs: () => number

  constructor(options: ResponseComposerOptions = {}) {
    this.mapper = options.mapper ?? createResponseComposerMapper()
    this.alternatives = options.alternatives ?? createAlternativeGenerator()
    this.confidence = options.confidence ?? createConfidenceExplainer()
    this.insights = options.insights ?? createTravelInsights()
    this.summary = options.summary ?? createResponseSummary()
    this.nowMs = options.nowMs ?? (() => Date.now())
  }

  compose(input: ResponseComposerInput): ResponseComposerResult {
    const started = this.nowMs()
    const inputFlights = input.flights ?? []
    const raw = normalizeComposerFlights(input)
    const valid = this.mapper.normalize(input)
    const invalidCount = Math.max(0, inputFlights.length - valid.length)

    const { recommendations, alternatives } = this.alternatives.generate(
      valid,
      input.labeled,
    )

    const bestId =
      recommendations.find((r) => r.kind === 'best_overall')?.optionId
      ?? recommendations[0]?.optionId
      ?? null
    const best = valid.find((f) => f.id === bestId) ?? valid[0] ?? null

    const confidence = this.confidence.explain({
      flights: valid,
      decisionConfidence: input.decisionConfidence,
    })

    const insights = this.insights.build({
      flights: valid,
      trip: input.trip,
      best,
    })

    const warnings = this.insights.warnings({
      flights: raw,
      validFlights: valid,
      best,
      invalidCount,
    })

    const summary = this.summary.build({
      trip: input.trip,
      recommendations,
      offerCount: valid.length,
    })

    return {
      version: SPRINT106_RESPONSE_COMPOSER_VERSION,
      enabled: true,
      conversationId: input.conversationId?.trim() || 'conversation',
      summary,
      recommendations,
      alternatives,
      insights,
      warnings,
      confidence,
      metadata: {
        offerCount: inputFlights.length,
        validOfferCount: valid.length,
        durationMs: Math.max(0, this.nowMs() - started),
        empty: valid.length === 0,
        source: valid.length === 0 ? 'empty' : 'provider_offers',
      },
    }
  }
}

export function createResponseComposer(
  options?: ResponseComposerOptions,
): ResponseComposer {
  return new ResponseComposer(options)
}

export function composeAiResponse(
  input: ResponseComposerInput,
  options?: ResponseComposerOptions,
): ResponseComposerResult {
  return createResponseComposer(options).compose(input)
}

export { isValidComposerFlight }
