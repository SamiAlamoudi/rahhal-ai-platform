/**
 * Sprint 106 — ResponseComposerRunner
 * Feature-flag gate: OFF → disabled result (legacy behavior unchanged).
 */

import {
  composeAiResponse,
  createResponseComposer,
  type ResponseComposer,
  type ResponseComposerOptions,
} from './ResponseComposer'
import { isResponseComposerEnabled } from './feature'
import type {
  ResponseComposerInput,
  ResponseComposerLogEntry,
  ResponseComposerResult,
} from './types'
import { SPRINT106_RESPONSE_COMPOSER_VERSION } from './types'

export interface ResponseComposerRunnerOptions extends ResponseComposerOptions {
  enabled?: boolean
  composer?: ResponseComposer
}

function disabledResult(input: ResponseComposerInput): ResponseComposerResult {
  return {
    version: SPRINT106_RESPONSE_COMPOSER_VERSION,
    enabled: false,
    conversationId: input.conversationId?.trim() || 'conversation',
    summary: {
      headline: '',
      executiveSummary: '',
      bestRecommendationLabel: null,
      keyPoints: [],
    },
    recommendations: [],
    alternatives: [],
    insights: [],
    warnings: [],
    confidence: {
      overall: 0,
      level: 'low',
      label: 'Disabled',
      priceConfidence: 0,
      scheduleConfidence: 0,
      recommendationConfidence: 0,
      explanations: ['ai.response_composer is OFF'],
    },
    metadata: {
      offerCount: input.flights?.length ?? 0,
      validOfferCount: 0,
      durationMs: 0,
      empty: true,
      source: 'disabled',
    },
  }
}

export class ResponseComposerRunner {
  private readonly options: ResponseComposerRunnerOptions
  private readonly composer: ResponseComposer
  private readonly logs: ResponseComposerLogEntry[] = []

  constructor(options: ResponseComposerRunnerOptions = {}) {
    this.options = options
    this.composer = options.composer ?? createResponseComposer(options)
  }

  getStructuredLogs(): readonly ResponseComposerLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  private emit(
    level: ResponseComposerLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    this.logs.push({
      at: new Date().toISOString(),
      level,
      message,
      meta,
    })
  }

  run(input: ResponseComposerInput): ResponseComposerResult {
    if (!isResponseComposerEnabled({ enabled: this.options.enabled })) {
      this.emit('info', 'response_composer.disabled')
      return disabledResult(input)
    }

    this.emit('info', 'response_composer.start', {
      offerCount: input.flights?.length ?? 0,
    })

    // Null / undefined flights → treat as empty provider response
    const safeInput: ResponseComposerInput = {
      ...input,
      flights: input.flights ?? [],
    }

    const result = this.composer.compose(safeInput)
    this.emit(result.metadata.empty ? 'warn' : 'info', 'response_composer.done', {
      validOfferCount: result.metadata.validOfferCount,
      recommendationCount: result.recommendations.length,
      warningCount: result.warnings.length,
    })
    return result
  }
}

export function createResponseComposerRunner(
  options?: ResponseComposerRunnerOptions,
): ResponseComposerRunner {
  return new ResponseComposerRunner(options)
}

export function runResponseComposer(
  input: ResponseComposerInput,
  options?: ResponseComposerRunnerOptions,
): ResponseComposerResult {
  return createResponseComposerRunner(options).run(input)
}

export { composeAiResponse }
