/**
 * Sprint 113 — AIOrchestrator
 * Feature-flag gate + pipeline coordination. Does not modify engines.
 */

import { createExecutionContext } from './ExecutionContext'
import { collectExecutionMetrics } from './ExecutionMetrics'
import { buildExecutionPlan } from './ExecutionPlanner'
import {
  runExecutionPipeline,
  type OrchestratorStageAdapters,
} from './ExecutionPipeline'
import {
  buildDisabledOrchestratorResult,
  buildOrchestratorResult,
} from './ExecutionResult'
import { isPipelineOrchestratorEnabled } from './feature'
import { validateOrchestratorInput } from './OrchestratorValidator'
import type {
  OrchestratorInput,
  OrchestratorLogEntry,
  OrchestratorResult,
  OrchestratorStructuredLogger,
} from './types'
import { createSilentOrchestratorLogger } from './types'

export interface AIOrchestratorOptions {
  enabled?: boolean
  logger?: OrchestratorStructuredLogger
  adapters?: OrchestratorStageAdapters
}

export class AIOrchestrator {
  private readonly options: AIOrchestratorOptions
  private readonly logger: OrchestratorStructuredLogger
  private readonly logs: OrchestratorLogEntry[] = []

  constructor(options: AIOrchestratorOptions = {}) {
    this.options = options
    this.logger = options.logger ?? createSilentOrchestratorLogger()
  }

  getStructuredLogs(): readonly OrchestratorLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  private emit(
    level: OrchestratorLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: OrchestratorLogEntry = {
      at: new Date().toISOString(),
      level,
      message,
      meta,
    }
    this.logs.push(entry)
    this.logger(entry)
  }

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const started = Date.now()

    if (!isPipelineOrchestratorEnabled({ enabled: this.options.enabled })) {
      this.emit('info', 'ai_orchestrator.disabled')
      return buildDisabledOrchestratorResult()
    }

    const validation = validateOrchestratorInput(input)
    if (!validation.ok) {
      this.emit('warn', 'ai_orchestrator.validation_failed', {
        errors: validation.errors,
      })
      const ctx = createExecutionContext(input, true)
      for (const err of validation.errors) ctx.addError(err)
      return buildOrchestratorResult({
        ok: false,
        empty: true,
        plan: null,
        context: ctx.snapshot(),
        stages: [],
        metrics: collectExecutionMetrics({
          pipelineDurationMs: Date.now() - started,
          timing: {},
          stages: [],
          confidence: 0,
        }),
        finalResponse: {
          headline: '',
          executiveSummary: '',
          recommendations: [],
          followUpQuestion: null,
          narrative: null,
          conciergeHints: [],
          warnings: validation.errors,
          confidence: 0,
          source: 'error',
        },
        artifacts: {
          memory: null,
          planner: null,
          providers: null,
          tripBuilder: null,
          decision: null,
          responseComposer: null,
          concierge: null,
        },
        validationErrors: validation.errors,
        logs: this.logs.map((l) => l.message),
        latencyMs: Date.now() - started,
      })
    }

    this.emit('info', 'ai_orchestrator.start', {
      conversationId: input.conversationId ?? null,
      messageCount: input.messages?.length ?? 0,
    })

    const ctx = createExecutionContext(input, true)
    const planStarted = Date.now()
    const plan = buildExecutionPlan(input)
    ctx.markTiming('planner', Date.now() - planStarted)
    ctx.addLog(`plan:${plan.reasons.join('|')}`)

    const pipeline = await runExecutionPipeline({
      input,
      plan,
      ctx,
      adapters: this.options.adapters,
    })

    const latencyMs = Date.now() - started
    const metrics = collectExecutionMetrics({
      pipelineDurationMs: latencyMs,
      timing: ctx.timing,
      stages: pipeline.stages,
      confidence: pipeline.finalResponse.confidence || ctx.confidence,
      totalTokens: pipeline.totalTokens,
    })

    this.emit('info', 'ai_orchestrator.done', {
      ok: true,
      stagesCompleted: metrics.stagesCompleted,
      earlyExit: plan.earlyExit,
    })

    return buildOrchestratorResult({
      ok: metrics.stagesFailed === 0,
      empty: pipeline.finalResponse.recommendations.length === 0
        && !pipeline.finalResponse.followUpQuestion
        && pipeline.finalResponse.source !== 'cache',
      plan,
      context: ctx.snapshot(),
      stages: pipeline.stages,
      metrics,
      finalResponse: pipeline.finalResponse,
      artifacts: {
        memory: pipeline.artifacts.memory,
        planner: pipeline.artifacts.planner,
        providers: pipeline.artifacts.providers,
        tripBuilder: pipeline.artifacts.tripBuilder,
        decision: pipeline.artifacts.decision,
        responseComposer: pipeline.artifacts.responseComposer,
        concierge: pipeline.artifacts.concierge,
      },
      validationErrors: [],
      logs: [...this.logs.map((l) => l.message), ...ctx.logs],
      latencyMs,
    })
  }
}

export function createAIOrchestrator(
  options?: AIOrchestratorOptions,
): AIOrchestrator {
  return new AIOrchestrator(options)
}

export async function runAIOrchestrator(
  input: OrchestratorInput,
  options?: AIOrchestratorOptions,
): Promise<OrchestratorResult> {
  return createAIOrchestrator(options).run(input)
}
