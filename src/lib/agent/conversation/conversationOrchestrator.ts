/**
 * Conversation Orchestrator — Phase 3 Stage 1.
 *
 * Sits above the Runtime Coordinator. Owns conversation management only:
 * intent → memory → stage plan → runtime invoke → conversational reply.
 *
 * Never plans trips, scores destinations, or edits itineraries.
 * Additive; gated by `ai.conversation_orchestrator` (default OFF).
 */

import {
  runRuntimeCoordinator,
  type RuntimeCoordinatorResult,
} from '../orchestrator/runtime'
import type { RuntimeStageId } from '../orchestrator/runtime/runtimeTypes'
import {
  CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  isConversationOrchestratorEnabled,
} from './conversationRegistry'
import { detectConversationIntent } from './conversationIntent'
import {
  appendConversationTurn,
  loadConversationMemory,
  markQuestionAnswered,
  mergeKnownFacts,
  resetConversationMemory,
  saveConversationMemory,
  setMissingInformation,
  setPendingClarification,
  withLastIntent,
} from './conversationMemory'
import {
  buildConversationContext,
  computeMissingInformation,
  extractKnownFactsFromText,
  scoreConversationConfidence,
} from './conversationContext'
import { planConversationStages } from './conversationPlanner'
import { buildConversationReply } from './conversationReply'
import { syncTripFromFacts, withIntentGoal } from './conversationState'
import {
  clamp01,
  type ConversationLocale,
  type ConversationOrchestratorInput,
  type ConversationOrchestratorResult,
  type ConversationReplyFormat,
  type ConversationState,
} from './types'

export interface ConversationOrchestratorTurnOptions {
  userText: string
  conversationId: string
  enabled?: boolean
  signal?: AbortSignal
  format?: ConversationReplyFormat
  now?: Date
}

export interface ConversationTurnLike {
  reply: string
  memory: unknown
  tripPlan: unknown
  meta: Record<string, unknown> | object
  toolBatch: unknown
}

function resolveLocale(value: unknown): ConversationLocale {
  return value === 'en' ? 'en' : 'ar'
}

function readConfidence(consultantResponse: unknown): number | null {
  if (!consultantResponse || typeof consultantResponse !== 'object') return null
  const body = (consultantResponse as { body?: { confidenceScore?: unknown } }).body
  const score = body?.confidenceScore
  return typeof score === 'number' && Number.isFinite(score) ? clamp01(score) : null
}

function readMissing(consultantResponse: unknown): string[] {
  if (!consultantResponse || typeof consultantResponse !== 'object') return []
  const body = (consultantResponse as { body?: { missingInformation?: unknown } }).body
  const missing = body?.missingInformation
  if (!Array.isArray(missing)) return []
  return missing.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

/**
 * Core conversation orchestration (no production planning).
 * Invokes Runtime Coordinator with the planned stage subset when intelligence is needed.
 */
export async function runConversationOrchestrator(
  input: ConversationOrchestratorInput,
): Promise<ConversationOrchestratorResult> {
  if (!isConversationOrchestratorEnabled({ enabled: input.enabled })) {
    throw new Error('conversation_orchestrator_disabled')
  }

  const locale = input.locale === 'en' ? 'en' : 'ar'
  const format: ConversationReplyFormat = input.format ?? 'consultant'
  const conversationId = input.conversationId.trim() || 'conversation'
  const userText = input.userText.trim()
  const now = input.now

  let state: ConversationState =
    input.state
      ? { ...input.state }
      : loadConversationMemory(conversationId, locale)

  const intent = detectConversationIntent(userText, {
    locale,
    pendingClarification: state.pendingClarification,
    lastIntent: state.lastIntent,
  })

  const extracted = extractKnownFactsFromText(userText)
  const knownMerged = mergeKnownFacts(
    mergeKnownFacts(state.knownFacts, input.known),
    extracted,
  )

  const context = buildConversationContext({
    conversationId,
    userText,
    locale,
    known: knownMerged,
    state,
  })

  state = {
    ...context.state,
    knownFacts: knownMerged,
  }
  state = syncTripFromFacts(state, knownMerged, now)
  state = withIntentGoal(state, intent, now)

  const localMissing = computeMissingInformation(knownMerged, intent)
  const stages = planConversationStages(intent, state)

  let runtime: RuntimeCoordinatorResult | null = null
  let consultantResponse: unknown | null = null

  if (stages.length > 0) {
    runtime = await runRuntimeCoordinator({
      locale,
      userText,
      conversationId,
      sessionId: conversationId,
      known: {
        destination: knownMerged.destination ?? null,
        origin: knownMerged.origin ?? null,
        budgetAmount: knownMerged.budgetAmount ?? null,
        budgetCurrency: knownMerged.budgetCurrency ?? null,
        durationDays: knownMerged.durationDays ?? null,
        adults: knownMerged.adults ?? null,
        children: knownMerged.children ?? null,
        monthHint: knownMerged.monthHint ?? null,
        interests: knownMerged.interests?.length ? [...knownMerged.interests] : undefined,
        tripPurpose: knownMerged.tripPurpose ?? null,
        compareWith: knownMerged.compareWith ?? null,
      },
      tripPlan: input.tripPlan,
      requirements: input.requirements,
      toolResults: input.toolResults,
      stages: stages as RuntimeStageId[],
      signal: input.signal,
      enabled: true,
      now,
    })
    consultantResponse = runtime.consultantResponse
  }

  const responseMissing = readMissing(consultantResponse)
  const missingInformation = [...new Set([...localMissing, ...responseMissing])].slice(0, 16)
  state = setMissingInformation(state, missingInformation, now)

  const confidence =
    readConfidence(consultantResponse)
    ?? scoreConversationConfidence({
      knownFacts: knownMerged,
      missingInformation,
      intent,
    })

  const replyBuilt = buildConversationReply({
    locale,
    format,
    confidence,
    consultantResponse,
    state,
    userText,
  })

  state = appendConversationTurn(
    state,
    {
      role: 'user',
      text: userText,
      intent,
      timestamp: (now ?? new Date()).toISOString(),
    },
    now,
  )
  state = appendConversationTurn(
    state,
    {
      role: 'assistant',
      text: replyBuilt.reply,
      intent,
      timestamp: (now ?? new Date()).toISOString(),
    },
    now,
  )

  if (replyBuilt.clarificationQuestion) {
    state = setPendingClarification(state, replyBuilt.clarificationQuestion, now)
  } else if (state.pendingClarification && intent === 'clarification_reply') {
    state = markQuestionAnswered(state, state.pendingClarification, now)
    state = setPendingClarification(state, null, now)
  } else {
    state = setPendingClarification(state, null, now)
  }

  state = withLastIntent(state, intent, now)
  saveConversationMemory(state)

  return {
    enabled: true,
    conversationId,
    intent,
    confidenceBand: replyBuilt.confidenceBand,
    confidence,
    stagesRequested: [...stages],
    reply: replyBuilt.reply,
    spokenText: replyBuilt.spokenText,
    format,
    clarificationQuestion: replyBuilt.clarificationQuestion,
    state,
    runtime,
    consultantResponse,
  }
}

export async function tryRunConversationOrchestrator(
  input: ConversationOrchestratorInput,
): Promise<ConversationOrchestratorResult | null> {
  if (!isConversationOrchestratorEnabled({ enabled: input.enabled })) return null
  try {
    return await runConversationOrchestrator({ ...input, enabled: true })
  } catch {
    return null
  }
}

/**
 * planTurn enrichment: conversation layer above Runtime Coordinator.
 * Preserves production tripPlan / memory; may replace conversational reply text.
 */
export async function enrichTurnWithConversationOrchestrator<T extends ConversationTurnLike>(
  turn: T,
  options: ConversationOrchestratorTurnOptions,
): Promise<T> {
  if (!isConversationOrchestratorEnabled({ enabled: options.enabled })) {
    return turn
  }

  try {
    const memory = turn.memory as {
      locale?: string
      requirements?: {
        destination?: string | null
        destinations?: string[]
        origin?: string | null
        budgetAmount?: number | null
        budgetCurrency?: string | null
        durationDays?: number | null
        travelers?: number | null
        interests?: string[]
        tripPurpose?: string | null
        travelerType?: string | null
      }
    }
    const req = memory.requirements ?? {}
    const toolResults =
      turn.toolBatch &&
      typeof turn.toolBatch === 'object' &&
      Array.isArray((turn.toolBatch as { results?: unknown[] }).results)
        ? (turn.toolBatch as { results: unknown[] }).results
        : undefined

    const orchestrated = await runConversationOrchestrator({
      conversationId: options.conversationId,
      userText: options.userText || turn.reply || '',
      locale: resolveLocale(memory.locale),
      format: options.format ?? 'consultant',
      known: {
        destination: req.destination ?? req.destinations?.[0] ?? null,
        origin: req.origin ?? null,
        budgetAmount: req.budgetAmount ?? null,
        budgetCurrency: req.budgetCurrency ?? null,
        durationDays: req.durationDays ?? null,
        adults: req.travelers ?? null,
        interests: req.interests?.length ? [...req.interests] : undefined,
        tripPurpose: req.tripPurpose ?? req.travelerType ?? null,
      },
      tripPlan: turn.tripPlan ?? undefined,
      requirements: req,
      toolResults,
      signal: options.signal,
      enabled: true,
      now: options.now,
    })

    const runtime = orchestrated.runtime as RuntimeCoordinatorResult | null

    return {
      ...turn,
      reply: orchestrated.reply || turn.reply,
      meta: {
        ...(turn.meta as Record<string, unknown>),
        spokenText: orchestrated.spokenText || (turn.meta as { spokenText?: string }).spokenText,
        conversationOrchestrator: {
          enabled: true as const,
          conversationId: orchestrated.conversationId,
          intent: orchestrated.intent,
          confidence: orchestrated.confidence,
          confidenceBand: orchestrated.confidenceBand,
          stagesRequested: [...orchestrated.stagesRequested],
          format: orchestrated.format,
          clarificationQuestion: orchestrated.clarificationQuestion,
          turnNumber: orchestrated.state.turnNumber,
        },
        ...(runtime
          ? {
              runtimeCoordinator: {
                enabled: true as const,
                sessionId: runtime.sessionId,
                executionOrder: runtime.executionOrder,
                success: runtime.success,
                cancelled: runtime.cancelled,
                stageCount: runtime.stages.length,
                telemetry: runtime.telemetry,
                stages: runtime.stages.map((s) => ({
                  stageId: s.stageId,
                  status: s.status,
                  durationMs: s.durationMs,
                  cacheHit: s.cacheHit,
                  errorCode: s.errorCode,
                })),
              },
            }
          : {}),
        ...(orchestrated.consultantResponse
          ? { consultantResponse: orchestrated.consultantResponse }
          : {}),
      },
    }
  } catch {
    return turn
  }
}

export const ConversationOrchestrator = {
  featureId: CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  run: runConversationOrchestrator,
  tryRun: tryRunConversationOrchestrator,
  enrichTurn: enrichTurnWithConversationOrchestrator,
  isEnabled: isConversationOrchestratorEnabled,
  resetMemory: resetConversationMemory,
}
