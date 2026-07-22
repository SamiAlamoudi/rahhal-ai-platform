/**
 * Sprint 111 — ConciergeRunner
 * Decision conversation layer after Response Composer.
 * Feature flag: ai.concierge_experience — OFF → disabled (no enhancement).
 */

import { explainConversation } from './ConversationExplainer'
import {
  buildConversationMetadata,
  optionsFromResponseComposer,
} from './ConversationMetadata'
import { isConciergeEnabled } from './feature'
import { narrateRecommendation } from './RecommendationNarrator'
import { analyzeSavings } from './SavingsAnalyzer'
import { simulateScenarios } from './ScenarioSimulator'
import { analyzeTradeoffs } from './TradeoffAnalyzer'
import type {
  ConciergeInput,
  ConciergeLogEntry,
  ConciergeRecommendationOption,
  ConciergeResult,
  ConciergeStructuredLogger,
} from './types'
import {
  createSilentConciergeLogger,
  SPRINT111_CONCIERGE_VERSION,
} from './types'

export interface ConciergeRunnerOptions {
  enabled?: boolean
  logger?: ConciergeStructuredLogger
}

function emptyMetadata(): ConciergeResult['metadata'] {
  return {
    confidence: 0,
    reasoningSummary: '',
    tradeoffs: [],
    warnings: [],
    highlights: [],
    bestFor: '',
    costSummary: '',
    qualitySummary: '',
  }
}

function disabledResult(input: ConciergeInput): ConciergeResult {
  return {
    version: SPRINT111_CONCIERGE_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    conversationId: input.conversationId?.trim() || 'conversation',
    selected: null,
    explanation: null,
    tradeoffs: [],
    scenarios: [],
    savings: null,
    narrative: null,
    metadata: emptyMetadata(),
    responseComposerAttachment: {
      narrativeLines: [],
      highlights: [],
      warnings: [],
      confidence: 0,
    },
    validationErrors: [],
    logs: ['concierge_disabled'],
    latencyMs: 0,
  }
}

function normalizeOptions(input: ConciergeInput): {
  options: ConciergeRecommendationOption[]
  validationErrors: string[]
} {
  const errors: string[] = []
  const fromInput = (input.recommendations ?? []).filter(Boolean)
  const fromComposer = optionsFromResponseComposer(input.responseComposer)

  const byId = new Map<string, ConciergeRecommendationOption>()
  for (const opt of [...fromInput, ...fromComposer]) {
    if (!opt || typeof opt !== 'object') {
      errors.push('invalid recommendation entry')
      continue
    }
    if (!opt.id || typeof opt.id !== 'string' || !opt.id.trim()) {
      errors.push('recommendation missing id')
      continue
    }
    if (opt.price != null && !Number.isFinite(opt.price)) {
      errors.push(`invalid price for ${opt.id}`)
      continue
    }
    if (!byId.has(opt.id)) {
      byId.set(opt.id, {
        ...opt,
        id: opt.id.trim(),
        currency: (opt.currency || input.currency || 'SAR').toUpperCase(),
        labels: Array.isArray(opt.labels) ? opt.labels : [],
        title: opt.title ?? null,
        hotelName: opt.hotelName ?? null,
        hotelStars: opt.hotelStars ?? null,
        kind: opt.kind ?? null,
        reason: opt.reason ?? null,
      })
    }
  }

  return { options: [...byId.values()], validationErrors: errors }
}

export class ConciergeRunner {
  private readonly options: ConciergeRunnerOptions
  private readonly logger: ConciergeStructuredLogger
  private readonly logs: ConciergeLogEntry[] = []

  constructor(options: ConciergeRunnerOptions = {}) {
    this.options = options
    this.logger = options.logger ?? createSilentConciergeLogger()
  }

  getStructuredLogs(): readonly ConciergeLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  private emit(
    level: ConciergeLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: ConciergeLogEntry = {
      at: new Date().toISOString(),
      level,
      message,
      meta,
    }
    this.logs.push(entry)
    this.logger(entry)
  }

  run(input: ConciergeInput): ConciergeResult {
    const started = Date.now()

    if (!isConciergeEnabled({ enabled: this.options.enabled })) {
      this.emit('info', 'concierge.disabled')
      return disabledResult(input)
    }

    this.emit('info', 'concierge.start', {
      recommendationCount: input.recommendations?.length ?? 0,
      hasResponseComposer: Boolean(input.responseComposer),
    })

    const { options, validationErrors } = normalizeOptions(input)

    if (options.length === 0) {
      this.emit('warn', 'concierge.empty')
      const metadata = buildConversationMetadata({
        selected: null,
        explanation: null,
        tradeoffs: [],
        savings: null,
        decisionConfidence: input.decisionConfidence,
        recommendations: [],
      })
      return {
        version: SPRINT111_CONCIERGE_VERSION,
        enabled: true,
        ok: false,
        empty: true,
        conversationId: input.conversationId?.trim() || 'conversation',
        selected: null,
        explanation: null,
        tradeoffs: [],
        scenarios: simulateScenarios({
          selected: null,
          recommendations: [],
          budget: input.budget,
          currency: input.currency ?? undefined,
        }),
        savings: analyzeSavings({
          selected: null,
          recommendations: [],
          budget: input.budget,
          currency: input.currency ?? undefined,
        }),
        narrative: narrateRecommendation({
          selected: null,
          explanation: null,
          tradeoffs: [],
          savings: null,
          alternatives: [],
        }),
        metadata,
        responseComposerAttachment: {
          narrativeLines: [],
          highlights: [],
          warnings: metadata.warnings.slice(),
          confidence: 0,
        },
        validationErrors,
        logs: this.logs.map((l) => l.message),
        latencyMs: Date.now() - started,
      }
    }

    const selectedId = input.selectedId?.trim() || options[0]!.id
    const selected =
      options.find((o) => o.id === selectedId) ?? options[0]!
    const alternatives = options.filter((o) => o.id !== selected.id)

    const explanation = explainConversation({
      selected,
      alternatives: options,
      decisionExplanation: input.decisionExplanation,
      decisionConfidence: input.decisionConfidence,
      travelerType: input.travelerType,
    })

    const tradeoffs = analyzeTradeoffs({
      selected,
      alternatives: options,
    })

    const scenarios = simulateScenarios({
      selected,
      recommendations: options,
      budget: input.budget,
      currency: input.currency ?? selected.currency,
    })

    const savings = analyzeSavings({
      selected,
      recommendations: options,
      budget: input.budget,
      currency: input.currency ?? selected.currency,
    })

    const narrative = narrateRecommendation({
      selected,
      explanation,
      tradeoffs,
      savings,
      alternatives,
    })

    const metadata = buildConversationMetadata({
      selected,
      explanation,
      tradeoffs,
      savings,
      decisionConfidence: input.decisionConfidence,
      recommendations: options,
    })

    const narrativeLines = [
      narrative.primary,
      ...narrative.alternatives,
      narrative.closing,
    ].filter((line): line is string => Boolean(line))

    this.emit('info', 'concierge.done', {
      selectedId: selected.id,
      tradeoffCount: tradeoffs.length,
      scenarioCount: scenarios.length,
    })

    return {
      version: SPRINT111_CONCIERGE_VERSION,
      enabled: true,
      ok: true,
      empty: false,
      conversationId: input.conversationId?.trim() || 'conversation',
      selected,
      explanation,
      tradeoffs,
      scenarios,
      savings,
      narrative,
      metadata,
      responseComposerAttachment: {
        narrativeLines,
        highlights: metadata.highlights.slice(),
        warnings: metadata.warnings.slice(),
        confidence: metadata.confidence,
      },
      validationErrors,
      logs: this.logs.map((l) => l.message),
      latencyMs: Date.now() - started,
    }
  }
}

export function createConciergeRunner(
  options?: ConciergeRunnerOptions,
): ConciergeRunner {
  return new ConciergeRunner(options)
}

export function runConcierge(
  input: ConciergeInput,
  options?: ConciergeRunnerOptions,
): ConciergeResult {
  return createConciergeRunner(options).run(input)
}
