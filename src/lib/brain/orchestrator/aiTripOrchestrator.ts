/**
 * Sprint 27 — AITripOrchestrator
 * Central coordinator for conversation → intent → plan → providers → aggregation → booking.
 * No new planning/search/booking engine — reuses Sprints 19–26.
 */

import type { AgentLocale, TripRequirements } from '../../agent/types'
import { isBookingFlowEnabled } from '../../bookingFlow/feature'
import { detectBookingFlowConversationEdit } from '../../bookingFlow/conversationEdits'
import { getBookingFlowController } from '../../bookingFlow/bookingFlowController'
import { searchOptionsToBookingSelectedItems } from '../../bookingFlow/searchOptionAdapter'
import type { BookingFlowStage } from '../../bookingFlow/types'
import type { BrainLocale, BrainTurnResult, TravelIntent } from '../types'
import type { TravelExecutionTurnResult } from '../execution/types'
import type { SearchAggregationTurnResult } from '../search/types'
import type { TripPlanningTurnResult } from '../tripPlanning/types'
import type { RunIntegratedBrainTurnInput } from '../integrationTypes'
import {
  buildOrchestratorCacheKey,
  clearOrchestratorCache,
  getOrchestratorCached,
  setOrchestratorCached,
} from './cache'
import { buildOrchestratorExecutionPlan } from './executionPlanBuilder'
import { isBrainContextMemoryEnabled } from '../memory/feature'
import {
  getOrCreateMemoryContextEngine,
  type MemoryEngineTurnResult,
} from '../memory'
import { isBrainTripOrchestratorEnabled } from './feature'
import { extractTravelIntentFromConversation } from './intent'
import { createOrchestratorLogger } from './logging'
import {
  createOrchestratorMetricsCollector,
  recordOrchestratorMetrics,
  resetOrchestratorMetrics,
} from './metrics'
import {
  getOrchestratorHandle,
  setOrchestratorHandle,
} from './sessionRegistry'
import { resetAITripOrchestrator } from './reset'
import type {
  AITripOrchestratorOptions,
  AITripOrchestratorRunInput,
  AITripOrchestratorTurnResult,
  OrchestratorAggregatedResponse,
  OrchestratorDomain,
  OrchestratorExecutionPlan,
  OrchestratorStage,
} from './types'

type PipelineRunner = (
  input: RunIntegratedBrainTurnInput,
) => Promise<BrainTurnResult>

/** Lazy load avoids a static cycle with integration.ts. */
async function runBrainPipeline(
  input: RunIntegratedBrainTurnInput,
): Promise<BrainTurnResult> {
  const mod = await import('../integration')
  return (mod.runIntegratedBrainPipeline as PipelineRunner)(input)
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RETRIES = 1
const DEFAULT_CACHE_TTL_MS = 30_000

function toBrainLocale(locale: AgentLocale | BrainLocale | undefined): BrainLocale {
  return locale === 'en' ? 'en' : 'ar'
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  )
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function mergeSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Orchestrator timeout', 'AbortError'))
  }, timeoutMs)

  const onExternal = () => {
    controller.abort(external?.reason ?? new DOMException('Aborted', 'AbortError'))
  }
  if (external) {
    if (external.aborted) onExternal()
    else external.addEventListener('abort', onExternal, { once: true })
  }

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer)
      external?.removeEventListener('abort', onExternal)
    },
  }
}

function buildAggregated(input: {
  intent: TravelIntent
  plan: OrchestratorExecutionPlan
  brain: BrainTurnResult
  bookingFlowId: string | null
  bookingFlowStage: BookingFlowStage | null
}): OrchestratorAggregatedResponse {
  const planning = input.brain.planning as TripPlanningTurnResult | null
  const execution = input.brain.execution as TravelExecutionTurnResult | null
  const search = input.brain.search as SearchAggregationTurnResult | null
  const domains = input.plan.requestedDomains
  const warnings: string[] = []

  if (execution?.summary?.partialSuccess) {
    warnings.push('Execution finished with partial success')
  }
  if (execution?.summary?.failedTypes?.length) {
    warnings.push(`Failed domains: ${execution.summary.failedTypes.join(', ')}`)
  }

  const top = search?.recommendation?.top
  const hasTripPlan = planning?.tripPlan?.status === 'complete'
  const hasExecution = Boolean(execution?.plan)
  const hasSearch = Boolean(search?.recommendation)
  const hasBookingFlow = Boolean(input.bookingFlowId)

  let headline = 'Trip orchestration in progress'
  if (hasSearch && top) {
    headline = `Recommended ${top.kind}: ${top.title}`
  } else if (planning?.clarification?.question) {
    headline = 'Need clarification before search'
  } else if (hasExecution && execution?.summary?.headline) {
    headline = execution.summary.headline
  } else if (hasTripPlan) {
    headline = 'Trip plan ready'
  }

  return {
    headline,
    intent: input.intent,
    domains,
    hasTripPlan,
    hasExecution,
    hasSearch,
    hasBookingFlow,
    recommendationTopId: top?.option.id ?? null,
    recommendationConfidence: search?.recommendation?.confidenceScore ?? null,
    executionState: execution?.plan?.state ?? null,
    bookingFlowStage: input.bookingFlowStage,
    bookingFlowId: input.bookingFlowId,
    warnings,
  }
}

async function attachBookingFlow(input: {
  conversationId: string
  userText: string
  userId: string
  brain: BrainTurnResult
  requirements?: TripRequirements | null
}): Promise<{ bookingFlowId: string | null; bookingFlowStage: BookingFlowStage | null }> {
  const controller = getBookingFlowController()
  const currency =
    input.requirements?.budgetCurrency ||
    (input.brain.context.memory.currency ?? 'SAR')

  let flow =
    controller.restoreLatest(input.userId) ??
    controller.createFlow({
      userId: input.userId,
      conversationId: input.conversationId,
      currency,
      budget: {
        amount: input.requirements?.budgetAmount ?? input.brain.context.memory.budget.amount,
        currency,
      },
      dates: {
        startDate:
          input.requirements?.startDate ??
          input.brain.context.memory.travelDates.startDate,
        endDate:
          input.requirements?.endDate ?? input.brain.context.memory.travelDates.endDate,
        durationDays:
          input.requirements?.durationDays ??
          input.brain.context.memory.travelDates.durationDays,
      },
      travelers: {
        adults:
          input.requirements?.travelers ?? input.brain.context.memory.travelers.adults,
        children: input.brain.context.memory.travelers.children,
        infants: input.brain.context.memory.travelers.infants,
        summary: null,
      },
    })

  controller.setStage(flow.id, 'conversation')
  if (input.brain.planning) controller.setStage(flow.id, 'planning')
  if (input.brain.execution) controller.setStage(flow.id, 'execution')

  const search = input.brain.search as SearchAggregationTurnResult | null
  if (search?.recommendation) {
    flow = controller.attachSearchRecommendation(flow.id, search.recommendation)
    const topOption = search.recommendation.top?.option
    if (topOption && !flow.bookingSessionId) {
      const selected = searchOptionsToBookingSelectedItems([topOption])
      const applied = await controller.applySelection({
        flowId: flow.id,
        items: selected,
      })
      flow = applied.flow
    }
  }

  const edit = detectBookingFlowConversationEdit(input.userText)
  if (edit.kind !== 'unknown') {
    const edited = controller.applyConversationEdit(flow.id, input.userText)
    flow = edited.flow
  }

  const synced = controller.syncBrain(flow.id, input.brain.context.memory)
  input.brain.context = {
    ...input.brain.context,
    memory: synced.memory,
  }

  const latest = controller.getFlow(flow.id) ?? flow
  return {
    bookingFlowId: latest.id,
    bookingFlowStage: latest.stage,
  }
}

export type AITripOrchestratorHandle = {
  runTurn: (input: AITripOrchestratorRunInput) => Promise<AITripOrchestratorTurnResult>
  options: () => Readonly<Required<Pick<AITripOrchestratorOptions, 'timeoutMs' | 'maxRetries' | 'cacheTtlMs'>>>
}

/**
 * Factory for the central AI Trip Orchestrator service.
 */
export function AITripOrchestrator(
  options: AITripOrchestratorOptions = {},
): AITripOrchestratorHandle {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS

  async function runTurn(
    input: AITripOrchestratorRunInput,
  ): Promise<AITripOrchestratorTurnResult> {
    const locale = toBrainLocale(input.locale)
    const logger = createOrchestratorLogger(options.onLog)
    const metrics = createOrchestratorMetricsCollector(input.conversationId)
    const started = Date.now()

    const enabled =
      typeof options.enabled === 'boolean'
        ? options.enabled
        : isBrainTripOrchestratorEnabled()

    if (!enabled) {
      const emptyPlan = buildOrchestratorExecutionPlan({
        conversationId: input.conversationId,
        intent: 'GeneralConversation',
        confidence: 0,
      })
      const result: AITripOrchestratorTurnResult = {
        conversationId: input.conversationId,
        stage: 'failed',
        intent: 'GeneralConversation',
        confidence: 0,
        executionPlan: emptyPlan,
        brain: null,
        bookingFlowId: null,
        bookingFlowStage: null,
        aggregated: {
          headline: 'Trip orchestrator disabled',
          intent: 'GeneralConversation',
          domains: [],
          hasTripPlan: false,
          hasExecution: false,
          hasSearch: false,
          hasBookingFlow: false,
          recommendationTopId: null,
          recommendationConfidence: null,
          executionState: null,
          bookingFlowStage: null,
          bookingFlowId: null,
          warnings: ['brain.trip_orchestrator is OFF'],
        },
        metrics: metrics.snapshot(),
        logs: logger.entries(),
        cacheHit: false,
        durationMs: Date.now() - started,
        error: 'trip_orchestrator_disabled',
        memory: null,
      }
      return result
    }

    const contextMemoryOn =
      typeof options.contextMemory === 'boolean'
        ? options.contextMemory
        : isBrainContextMemoryEnabled()

    metrics.markStageStart('intent')
    logger.log('info', 'intent', 'Extracting travel intent from conversation')
    const classification = extractTravelIntentFromConversation({
      userText: input.userText,
      locale,
    })
    metrics.setIntent(classification.intent)
    metrics.markStageEnd('intent')
    logger.log('info', 'intent', 'Intent classified', {
      intent: classification.intent,
      confidence: classification.confidence,
    })

    /** Sprint 28 — run memory/context engine before the planning pipeline when enabled. */
    let memoryResult: MemoryEngineTurnResult | null = null
    if (contextMemoryOn) {
      logger.log('info', 'orchestrator', 'Running conversation memory & context engine')
      const memoryEngine = getOrCreateMemoryContextEngine('orchestrator', {
        enabled: true,
      })
      memoryResult = memoryEngine.runTurn({
        conversationId: input.conversationId,
        userText: input.userText,
        locale,
        userId: input.userId ?? null,
        intent: classification.intent,
        persistLongTerm: true,
      })
      // Seed shared brain session so planners see long-term + short-term prefs.
      try {
        const { getOrCreateBrainOrchestrator } = await import('../integration')
        const brainOrch = getOrCreateBrainOrchestrator(input.conversationId, locale, {
          travelEngine: true,
        })
        const ctx = brainOrch.getContext()
        brainOrch.setContext({
          ...ctx,
          memory: {
            ...ctx.memory,
            ...memoryResult.context.workingMemory,
            destinations: memoryResult.context.workingMemory.destinations,
            budget: memoryResult.context.workingMemory.budget,
            travelDates: memoryResult.context.workingMemory.travelDates,
            travelers: memoryResult.context.workingMemory.travelers,
            airlinePreferences: memoryResult.context.workingMemory.airlinePreferences,
            hotelPreferences: memoryResult.context.workingMemory.hotelPreferences,
            activities: memoryResult.context.workingMemory.activities,
            askedFields: memoryResult.context.workingMemory.askedFields,
            answeredFields: memoryResult.context.workingMemory.answeredFields,
          },
        })
      } catch {
        // Seeding is best-effort; pipeline still runs.
      }
      logger.log('info', 'orchestrator', 'Memory context assembled', {
        missingSlots: memoryResult.missingSlots,
        followUps: memoryResult.followUpQuestions.length,
        summarized: memoryResult.summarized,
        hasLongTerm: Boolean(memoryResult.longTerm),
      })
    }

    const cacheKey = buildOrchestratorCacheKey({
      conversationId: input.conversationId,
      userText: input.userText,
      locale,
    })
    if (!input.bypassCache && cacheTtlMs > 0) {
      const cached = getOrchestratorCached(cacheKey)
      if (cached) {
        metrics.setCacheHit(true)
        metrics.setSuccess(true)
        logger.log('info', 'orchestrator', 'Cache hit', { cacheKey })
        const hit: AITripOrchestratorTurnResult = {
          ...cached,
          cacheHit: true,
          logs: [...cached.logs, ...logger.entries()],
          metrics: {
            ...metrics.snapshot(),
            ...cached.metrics,
            cacheHit: true,
            durationMs: Date.now() - started,
          },
          durationMs: Date.now() - started,
          memory: memoryResult ?? cached.memory ?? null,
        }
        recordOrchestratorMetrics(hit.metrics)
        return hit
      }
    }

    let executionPlan = buildOrchestratorExecutionPlan({
      conversationId: input.conversationId,
      intent: classification.intent,
      confidence: classification.confidence,
    })
    metrics.setDomainsRequested(executionPlan.requestedDomains)
    metrics.markStageStart('execution_plan')
    logger.log('info', 'execution_plan', 'Built orchestrator execution plan', {
      planId: executionPlan.id,
      domains: executionPlan.requestedDomains,
    })
    metrics.markStageEnd('execution_plan')

    const bookingOn =
      typeof input.bookingFlow === 'boolean'
        ? input.bookingFlow
        : typeof options.bookingFlow === 'boolean'
          ? options.bookingFlow
          : isBookingFlowEnabled()

    let lastError: string | null = null
    let brain: BrainTurnResult | null = null
    let attempt = 0

    metrics.markStageStart('provider_search')
    while (attempt <= maxRetries) {
      const merged = mergeSignals(input.signal, timeoutMs)
      try {
        logger.log('info', 'provider_search', `Running brain pipeline (attempt ${attempt + 1})`)
        const pipelineInput: RunIntegratedBrainTurnInput = {
          conversationId: input.conversationId,
          userText: input.userText,
          locale,
          requirements: input.requirements as TripRequirements | null | undefined,
          travelEngine: true,
          tripPlanning: true,
          execution: true,
          search: true,
          signal: merged.signal,
        }
        brain = await (options.runPipeline ?? runBrainPipeline)(pipelineInput)
        merged.clear()
        lastError = null

        // Sprint 28 — sync working memory preferences back into short-term after pipeline.
        if (contextMemoryOn && memoryResult && brain?.context?.memory) {
          const memoryEngine = getOrCreateMemoryContextEngine('orchestrator', {
            enabled: true,
          })
          memoryEngine.seedFromBrainMemory({
            conversationId: input.conversationId,
            userId: input.userId ?? null,
            locale,
            memory: brain.context.memory,
          })
        }
        break
      } catch (err) {
        merged.clear()
        if (isAbortError(err)) {
          metrics.addTimeout()
          lastError = 'timeout_or_aborted'
          logger.log('warn', 'provider_search', 'Pipeline aborted or timed out', {
            attempt,
          })
          if (input.signal?.aborted) break
        } else {
          lastError = err instanceof Error ? err.message : String(err)
          logger.log('error', 'provider_search', 'Pipeline failed', {
            attempt,
            error: lastError,
          })
        }
        if (attempt >= maxRetries) break
        metrics.addRetry()
        attempt += 1
        await sleep(50 * attempt, input.signal)
      }
    }
    metrics.markStageEnd('provider_search')

    if (!brain) {
      metrics.setError(lastError ?? 'pipeline_failed')
      metrics.setSuccess(false)
      const failed: AITripOrchestratorTurnResult = {
        conversationId: input.conversationId,
        stage: lastError === 'timeout_or_aborted' ? 'cancelled' : 'failed',
        intent: classification.intent,
        confidence: classification.confidence,
        executionPlan,
        brain: null,
        bookingFlowId: null,
        bookingFlowStage: null,
        aggregated: {
          headline: 'Trip orchestration failed',
          intent: classification.intent,
          domains: executionPlan.requestedDomains,
          hasTripPlan: false,
          hasExecution: false,
          hasSearch: false,
          hasBookingFlow: false,
          recommendationTopId: null,
          recommendationConfidence: null,
          executionState: null,
          bookingFlowStage: null,
          bookingFlowId: null,
          warnings: [lastError ?? 'unknown'],
        },
        metrics: metrics.snapshot(),
        logs: logger.entries(),
        cacheHit: false,
        durationMs: Date.now() - started,
        error: lastError,
        memory: memoryResult,
      }
      recordOrchestratorMetrics(failed.metrics)
      return failed
    }

    const planning = brain.planning as TripPlanningTurnResult | null
    executionPlan = buildOrchestratorExecutionPlan({
      conversationId: input.conversationId,
      intent: (brain.plan.intent as TravelIntent) || classification.intent,
      confidence: brain.plan.confidence || classification.confidence,
      tripPlan: planning?.tripPlan ?? null,
      explicitDomains: executionPlan.requestedDomains as OrchestratorDomain[],
    })

    const execution = brain.execution as TravelExecutionTurnResult | null
    if (execution?.results) {
      metrics.addProviderCalls(execution.results.length)
    }

    metrics.markStageStart('aggregation')
    logger.log('info', 'aggregation', 'Aggregating pipeline results')
    metrics.markStageEnd('aggregation')

    let bookingFlowId: string | null = null
    let bookingFlowStage: BookingFlowStage | null = null
    if (bookingOn) {
      metrics.markStageStart('booking')
      logger.log('info', 'booking', 'Attaching booking flow')
      try {
        const attached = await attachBookingFlow({
          conversationId: input.conversationId,
          userText: input.userText,
          userId: input.userId || input.conversationId,
          brain,
          requirements: input.requirements as TripRequirements | null | undefined,
        })
        bookingFlowId = attached.bookingFlowId
        bookingFlowStage = attached.bookingFlowStage
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.log('warn', 'booking', 'Booking flow attach failed', { error: msg })
      }
      metrics.markStageEnd('booking')
    }

    const completedDomains = executionPlan.domains
      .filter((d) => d.enabled)
      .map((d) => d.domain)
      .filter((domain) => {
        if (!execution?.results?.length) return false
        const taskType = executionPlan.domains.find((d) => d.domain === domain)?.taskType
        return execution.results.some((r) => r.type === taskType && r.success)
      })
    metrics.setDomainsCompleted(completedDomains)

    const intent = (brain.plan.intent as TravelIntent) || classification.intent
    const aggregated = buildAggregated({
      intent,
      plan: executionPlan,
      brain,
      bookingFlowId,
      bookingFlowStage,
    })

    const partial = Boolean(execution?.summary?.partialSuccess)
    metrics.setSuccess(true, partial)
    metrics.setError(null)

    const stage: OrchestratorStage = aggregated.hasSearch
      ? 'complete'
      : planning?.stage === 'clarify'
        ? 'planning'
        : aggregated.hasExecution
          ? 'aggregation'
          : 'planning'

    logger.log('info', 'complete', 'Orchestration turn finished', {
      stage,
      headline: aggregated.headline,
    })

    const result: AITripOrchestratorTurnResult = {
      conversationId: input.conversationId,
      stage,
      intent,
      confidence: brain.plan.confidence || classification.confidence,
      executionPlan,
      brain,
      bookingFlowId,
      bookingFlowStage,
      aggregated,
      metrics: metrics.snapshot(),
      logs: logger.entries(),
      cacheHit: false,
      durationMs: Date.now() - started,
      error: null,
      memory: memoryResult,
    }

    if (cacheTtlMs > 0 && result.stage === 'complete') {
      setOrchestratorCached(cacheKey, result, cacheTtlMs)
    }
    recordOrchestratorMetrics(result.metrics)
    return result
  }

  return {
    runTurn,
    options: () => ({ timeoutMs, maxRetries, cacheTtlMs }),
  }
}

export function getOrCreateAITripOrchestrator(
  key = 'default',
  options?: AITripOrchestratorOptions,
): AITripOrchestratorHandle {
  const existing = getOrchestratorHandle(key) as AITripOrchestratorHandle | undefined
  if (existing && !options) return existing
  const created = AITripOrchestrator(options)
  setOrchestratorHandle(key, created)
  return created
}

export { resetAITripOrchestrator, clearOrchestratorCache, resetOrchestratorMetrics }
