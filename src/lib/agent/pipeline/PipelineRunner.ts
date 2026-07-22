/**
 * Sprint 115 — PipelineRunner
 * Single entry point for the unified AI execution pipeline.
 */

import { createPipelineContext } from './PipelineContext'
import {
  createExecutionPipeline,
  type PipelineStageAdapters,
} from './ExecutionPipeline'
import { explainPipeline } from './PipelineExplainer'
import { createPipelineLogger, type PipelineStructuredLogger } from './PipelineLogger'
import {
  collectPipelineMetrics,
  emptyPipelineMetrics,
} from './PipelineMetrics'
import {
  buildDisabledPipelineResult,
  buildPipelineResult,
  type PipelineFinalResponse,
  type PipelineResult,
} from './PipelineResult'
import type { PipelineInput } from './PipelineStages'
import { validatePipelineInput } from './PipelineValidator'
import { isExecutionPipelineEnabled } from './feature'

export interface PipelineRunnerOptions {
  enabled?: boolean
  logger?: PipelineStructuredLogger
  adapters?: PipelineStageAdapters
  stageTimeoutMs?: number
  maxRetries?: number
  continueOnWarning?: boolean
}

function assembleFinalResponse(
  ctx: ReturnType<typeof createPipelineContext>,
  partial: boolean,
  earlyExit: boolean,
): PipelineFinalResponse {
  const rc = ctx.artifacts.response_composer
  const concierge = ctx.artifacts.concierge
  const recommendations = Array.isArray(rc?.recommendations)
    ? (rc!.recommendations as PipelineFinalResponse['recommendations'])
    : []
  const memoryHints = Array.isArray(ctx.artifacts.memory?.conciergeHints)
    ? (ctx.artifacts.memory!.conciergeHints as string[])
    : []
  const conciergeHints = [
    ...memoryHints,
    ...(typeof concierge?.narrative === 'string' ? [concierge.narrative] : []),
  ]

  let source: PipelineFinalResponse['source'] = 'pipeline'
  if (earlyExit) source = 'early_exit'
  else if (partial) source = 'partial'
  else if (ctx.errors.length && recommendations.length === 0) source = 'error'

  return {
    headline: typeof rc?.headline === 'string' ? rc.headline : '',
    executiveSummary:
      typeof rc?.executiveSummary === 'string' ? rc.executiveSummary : '',
    narrative: typeof concierge?.narrative === 'string' ? concierge.narrative : null,
    followUpQuestion: earlyExit
      ? 'Could you share destination and travel dates?'
      : null,
    recommendations,
    conciergeHints,
    warnings: [
      ...(Array.isArray(rc?.warnings) ? (rc!.warnings as string[]) : []),
      ...ctx.warnings,
    ],
    confidence: ctx.confidence,
    source,
  }
}

export class PipelineRunner {
  private readonly options: PipelineRunnerOptions
  private readonly logger: ReturnType<typeof createPipelineLogger>

  constructor(options: PipelineRunnerOptions = {}) {
    this.options = options
    this.logger = createPipelineLogger(options.logger)
  }

  getStructuredLogs() {
    return this.logger.getEntries()
  }

  clearStructuredLogs(): void {
    this.logger.clear()
  }

  async run(input: PipelineInput): Promise<PipelineResult> {
    const started = Date.now()

    if (!isExecutionPipelineEnabled({ enabled: this.options.enabled })) {
      this.logger.info('execution_pipeline.disabled')
      return buildDisabledPipelineResult(emptyPipelineMetrics(), this.logger.messages())
    }

    const validation = validatePipelineInput(input)
    if (!validation.ok) {
      this.logger.warn('execution_pipeline.validation_failed', {
        errors: validation.errors,
      })
      const ctx = createPipelineContext(input, true)
      for (const err of validation.errors) ctx.addError(err)
      return buildPipelineResult({
        ctx,
        metrics: collectPipelineMetrics({
          pipelineDurationMs: Date.now() - started,
          stages: [],
          confidence: 0,
        }),
        finalResponse: {
          headline: '',
          executiveSummary: '',
          narrative: null,
          followUpQuestion: null,
          recommendations: [],
          conciergeHints: [],
          warnings: validation.errors,
          confidence: 0,
          source: 'error',
        },
        explanation: 'Pipeline validation failed.',
        validationErrors: validation.errors,
        logs: this.logger.messages(),
        latencyMs: Date.now() - started,
        ok: false,
        empty: true,
        partial: false,
      })
    }

    for (const w of validation.warnings) {
      this.logger.warn('execution_pipeline.validation_warning', { warning: w })
    }

    this.logger.info('execution_pipeline.start', {
      conversationId: input.conversationId ?? null,
      userId: input.userId ?? null,
    })

    const ctx = createPipelineContext(input, true)
    const pipeline = createExecutionPipeline({
      adapters: this.options.adapters,
      logger: this.logger,
      stageTimeoutMs: this.options.stageTimeoutMs ?? input.stageTimeoutMs ?? undefined,
      maxRetries: this.options.maxRetries ?? input.maxRetries ?? undefined,
      continueOnWarning:
        this.options.continueOnWarning ?? input.continueOnWarning ?? true,
    })

    await pipeline.run({ input, ctx })

    const failedHard = ctx.stageResults.some(
      (s) => s.status === 'failed' || s.status === 'timed_out',
    )
    const recovered = ctx.stageResults.some((s) => s.status === 'recovered')
    const partial = recovered || (failedHard && (input.continueOnWarning ?? true))
    const empty =
      ctx.flights.length === 0
      && ctx.hotels.length === 0
      && !ctx.artifacts.trip_builder
    const ok = !failedHard || partial

    const finalResponse = assembleFinalResponse(ctx, partial, ctx.earlyExit)
    const explanation = explainPipeline({
      ctx,
      stages: ctx.stageResults,
      partial,
      earlyExit: ctx.earlyExit,
    })
    const metrics = collectPipelineMetrics({
      pipelineDurationMs: Date.now() - started,
      stages: ctx.stageResults,
      confidence: ctx.confidence,
    })

    this.logger.info('execution_pipeline.done', {
      ok,
      partial,
      confidence: ctx.confidence,
      stages: ctx.stageResults.length,
    })

    return buildPipelineResult({
      ctx,
      metrics,
      finalResponse,
      explanation,
      validationErrors: [],
      logs: this.logger.messages(),
      latencyMs: Date.now() - started,
      ok,
      empty,
      partial,
    })
  }
}

export function createPipelineRunner(
  options?: PipelineRunnerOptions,
): PipelineRunner {
  return new PipelineRunner(options)
}

export async function runUnifiedExecutionPipeline(
  input: PipelineInput,
  options?: PipelineRunnerOptions,
): Promise<PipelineResult> {
  return createPipelineRunner(options).run(input)
}

/** Alias matching Sprint naming. */
export const runExecutionPipeline = runUnifiedExecutionPipeline
