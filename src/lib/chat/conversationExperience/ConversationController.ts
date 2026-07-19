/**
 * Sprint 32 — ConversationController
 * Conversational UX layer that orchestrates UnifiedTravelPlanner + AITripOrchestrator.
 * Does NOT duplicate planning, booking, or provider logic.
 */

import {
  UnifiedTravelPlanner,
  type UnifiedTravelPlanResult,
  type UnifiedTravelPlannerHandle,
  type UnifiedTravelPlannerOptions,
} from '../../brain/unifiedTravel'
import {
  appendMessage,
  createConversationMessage,
  createConversationSession,
  updateSessionState,
} from './ConversationSession'
import {
  applyCommandToState,
  applyUserTextToState,
  detectConversationCommand,
} from './ConversationState'
import {
  ConversationEvents,
  createConversationEvent,
} from './ConversationEvents'
import { FollowUpQuestionEngine, createFollowUpQuestionEngine } from './FollowUpQuestionEngine'
import { ResponseComposer, createResponseComposer } from './ResponseComposer'
import { ConversationRenderer, createConversationRenderer } from './ConversationRenderer'
import { StreamingResponse } from './StreamingResponse'
import { isConversationUiEnabled } from './feature'
import type {
  ConversationSession,
  ConversationTurnInput,
  ConversationTurnResult,
  ConversationPhase,
} from './types'
import type { ChatStreamChunk } from '../chatTypes'

export type ConversationControllerOptions = {
  /** Override FeatureRegistry for this instance. */
  enabled?: boolean
  /** Inject UnifiedTravelPlanner (tests). */
  planner?: UnifiedTravelPlannerHandle
  plannerOptions?: UnifiedTravelPlannerOptions
  events?: ConversationEvents
  followUps?: FollowUpQuestionEngine
  composer?: ResponseComposer
  renderer?: ConversationRenderer
  /** Prefer skipping nested orchestrator when planner already injects one. */
  skipPlannerOrchestrator?: boolean
}

export type ConversationControllerHandle = {
  handleTurn(input: ConversationTurnInput): Promise<ConversationTurnResult>
  streamTurn(input: ConversationTurnInput): AsyncGenerator<ChatStreamChunk>
  getSession(conversationId: string): ConversationSession | null
  listSessions(): ConversationSession[]
  reset(conversationId?: string): void
  events: ConversationEvents
  isEnabled(): boolean
}

export function ConversationController(
  options: ConversationControllerOptions = {},
): ConversationControllerHandle {
  const events = options.events ?? new ConversationEvents()
  const followUps = options.followUps ?? createFollowUpQuestionEngine()
  const composer = options.composer ?? createResponseComposer()
  const renderer = options.renderer ?? createConversationRenderer()
  const streaming = new StreamingResponse({ delayMs: 0 })
  const sessions = new Map<string, ConversationSession>()

  const planner =
    options.planner
    ?? UnifiedTravelPlanner({
      enabled: true,
      skipOrchestrator: options.skipPlannerOrchestrator === true,
      ...options.plannerOptions,
    })

  function enabled(): boolean {
    if (typeof options.enabled === 'boolean') return options.enabled
    return isConversationUiEnabled()
  }

  function getOrCreateSession(conversationId: string, locale: 'ar' | 'en'): ConversationSession {
    const existing = sessions.get(conversationId)
    if (existing) return existing
    const session = createConversationSession({ conversationId, locale })
    sessions.set(conversationId, session)
    events.emit(createConversationEvent('session_started', conversationId, { sessionId: session.id }))
    return session
  }

  async function runTurn(input: ConversationTurnInput): Promise<ConversationTurnResult> {
    const started = Date.now()
    const locale = input.locale === 'ar' ? 'ar' : 'en'

    if (!enabled()) {
      const session = getOrCreateSession(input.conversationId, locale)
      const userMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'user',
        content: input.userText,
      })
      const structured = composer.compose({
        planResult: null,
        phase: 'error',
        locale,
        clarificationQuestion:
          'Conversation UI is disabled (brain.conversation_ui is OFF).',
      })
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: false },
      })
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: null,
        commandKind: 'unknown',
        durationMs: Date.now() - started,
      }
    }

    events.emit(createConversationEvent('turn_started', input.conversationId, {
      userText: input.userText,
    }))

    let session = getOrCreateSession(input.conversationId, locale)
    let state = applyUserTextToState(
      { ...session.state, locale },
      input.userText,
    )

    const commandKind = state.pendingFollowUpField
      ? 'clarify_answer'
      : detectConversationCommand(input.userText)

    events.emit(createConversationEvent('command_detected', input.conversationId, {
      commandKind,
    }))

    state = applyCommandToState(state, commandKind)

    // Numeric traveler answers for pending follow-up.
    if (commandKind === 'clarify_answer' || state.pendingFollowUpField === 'travelers') {
      const travelers = parseTravelers(input.userText)
      if (travelers) {
        state = {
          ...state,
          context: {
            ...state.context,
            adults: travelers.adults,
            children: travelers.children,
          },
          travelersConfirmed: true,
          pendingFollowUpField: null,
        }
      }
    }

    const userMessage = createConversationMessage({
      conversationId: input.conversationId,
      role: 'user',
      content: input.userText,
      commandKind,
    })
    session = appendMessage(session, userMessage)

    // Ask follow-up only when absolutely required (destination / travelers).
    if (followUps.shouldAskBeforePlanning(state) && commandKind !== 'compare_options') {
      const question = followUps.nextQuestion(state)
      const phase: ConversationPhase = 'clarifying'
      state = {
        ...state,
        phase,
        pendingFollowUpField: question?.field ?? 'destination',
      }
      events.emit(createConversationEvent('follow_up', input.conversationId, {
        field: question?.field,
        question: question?.question,
      }))

      const structured = composer.compose({
        planResult: null,
        phase,
        locale,
        clarificationQuestion: question?.question ?? state.pendingFollowUpField,
      })
      structured.followUps = question ? [question] : []
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, clarifying: true },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)

      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: null,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Compare without re-planning when we already have options.
    if (commandKind === 'compare_options' && state.lastPlanResult?.plans.length) {
      state = { ...state, phase: 'comparing', compareMode: true }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'comparing',
        locale,
        compareMode: true,
      })
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, compare: true },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        compare: true,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Plan / regenerate / edit via UnifiedTravelPlanner (reuses orchestrator internally).
    state = { ...state, phase: 'planning' }
    events.emit(createConversationEvent('planning_started', input.conversationId, {
      editCount: state.editCount,
    }))

    let planResult: UnifiedTravelPlanResult
    try {
      planResult = await planner.planTrip({
        conversationId: input.conversationId,
        userText: input.userText,
        locale,
        userId: input.userId,
        signal: input.signal,
        contextOverrides: state.context,
      })
    } catch (error) {
      events.emit(createConversationEvent('error', input.conversationId, {
        message: error instanceof Error ? error.message : 'planning_failed',
      }))
      state = { ...state, phase: 'error' }
      const structured = composer.compose({
        planResult: null,
        phase: 'error',
        locale,
        clarificationQuestion:
          locale === 'ar'
            ? 'تعذر إكمال التخطيط. حاول مرة أخرى.'
            : 'Could not complete planning. Please try again.',
      })
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, error: true },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: null,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    events.emit(createConversationEvent('planning_completed', input.conversationId, {
      stage: planResult.stage,
      plans: planResult.plans.length,
    }))

    // Planner may still ask for destination.
    if (planResult.stage === 'clarifying') {
      state = {
        ...state,
        phase: 'clarifying',
        pendingFollowUpField: planResult.followUps[0]?.field ?? 'destination',
        lastPlanResult: planResult,
      }
    } else {
      state = {
        ...state,
        phase: state.compareMode ? 'comparing' : 'presenting',
        pendingFollowUpField: null,
        lastPlanResult: planResult,
        // Merge planner-enriched context hints from successful plans.
        context: {
          ...state.context,
          destination: state.context.destination || planResult.topPlan?.flight?.to || state.context.destination,
          origin: state.context.origin || planResult.topPlan?.flight?.from || state.context.origin,
        },
      }
    }

    const structured = composer.compose({
      planResult,
      phase: state.phase,
      locale,
      compareMode: state.compareMode || commandKind === 'compare_options',
      clarificationQuestion:
        planResult.stage === 'clarifying'
          ? planResult.followUps[0]?.question ?? planResult.headline
          : null,
    })

    events.emit(createConversationEvent('response_composed', input.conversationId, {
      confidence: structured.confidenceScore,
      topPlanId: structured.topPlanId,
    }))

    const renderedText = renderer.render(structured, locale)
    const assistantMessage = createConversationMessage({
      conversationId: input.conversationId,
      role: 'assistant',
      content: renderedText,
      structured,
      meta: {
        conversationUi: true,
        plannerStage: planResult.stage,
        confidenceScore: planResult.confidenceScore,
        orchestrator: planResult.orchestrator,
        memory: planResult.memory,
      },
    })

    session = appendMessage(updateSessionState(session, state), assistantMessage)
    sessions.set(input.conversationId, session)

    events.emit(createConversationEvent('turn_completed', input.conversationId, {
      durationMs: Date.now() - started,
      phase: state.phase,
    }))

    return {
      session,
      userMessage,
      assistantMessage,
      structured,
      renderedText,
      planResult,
      commandKind,
      durationMs: Date.now() - started,
    }
  }

  return {
    events,
    isEnabled: enabled,

    handleTurn: runTurn,

    async *streamTurn(input: ConversationTurnInput): AsyncGenerator<ChatStreamChunk> {
      const result = await runTurn(input)
      yield* streaming.stream(result.renderedText, result.structured, {
        signal: input.signal,
        delayMs: 0,
        meta: {
          conversationUi: enabled(),
          commandKind: result.commandKind,
          phase: result.session.state.phase,
          planResult: result.planResult
            ? {
              stage: result.planResult.stage,
              confidenceScore: result.planResult.confidenceScore,
              topPlanId: result.planResult.topPlan?.id ?? null,
            }
            : null,
        },
        onDelta: (text) => {
          events.emit(createConversationEvent('stream_delta', input.conversationId, { text }))
        },
      })
      events.emit(createConversationEvent('stream_done', input.conversationId, {
        messageId: result.assistantMessage.id,
      }))
    },

    getSession(conversationId: string) {
      return sessions.get(conversationId) ?? null
    },

    listSessions() {
      return [...sessions.values()]
    },

    reset(conversationId?: string) {
      if (conversationId) {
        sessions.delete(conversationId)
        return
      }
      sessions.clear()
      events.clear()
    },
  }
}

let sharedController: ConversationControllerHandle | null = null

export function getOrCreateConversationController(
  options?: ConversationControllerOptions,
): ConversationControllerHandle {
  if (!sharedController) {
    sharedController = ConversationController(options)
  }
  return sharedController
}

export function resetConversationController(): void {
  sharedController?.reset()
  sharedController = null
}

function parseTravelers(text: string): { adults: number; children: number } | null {
  const lower = text.toLowerCase().trim()
  if (/^(just )?(me|myself|solo)$/.test(lower) || /^one(\s+adult)?$/.test(lower)) {
    return { adults: 1, children: 0 }
  }
  if (/^two(\s+adults?)?$/.test(lower)) return { adults: 2, children: 0 }
  if (/^three(\s+adults?)?$/.test(lower)) return { adults: 3, children: 0 }
  if (/^four(\s+adults?)?$/.test(lower)) return { adults: 4, children: 0 }

  const adultsMatch = lower.match(/(\d+)\s*adults?/)
  const childrenMatch = lower.match(/(\d+)\s*(children|kids|child)/)
  const bare = lower.match(/^(\d+)\s*(travelers?|people|persons?)?$/)
  if (adultsMatch || childrenMatch) {
    return {
      adults: adultsMatch ? Number(adultsMatch[1]) : 2,
      children: childrenMatch ? Number(childrenMatch[1]) : 0,
    }
  }
  if (bare) {
    return { adults: Math.max(1, Number(bare[1])), children: 0 }
  }
  return null
}
