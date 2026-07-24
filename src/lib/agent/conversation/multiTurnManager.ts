/**
 * Multi-Turn Conversation Manager — Phase 3 Stage 2.
 *
 * Maintains dialogue continuity across turns. Conversation management only.
 * Never plans trips, scores destinations, or edits itineraries.
 * Additive; gated by `ai.multi_turn_conversation` (default OFF).
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import { extractKnownFactsFromText } from './conversationContext'
import { isConversationOrchestratorEnabled } from './conversationRegistry'
import { tryRunConversationOrchestrator } from './conversationOrchestrator'
import {
  applyClarificationToSession,
  decideClarification,
  resolvePendingClarification,
} from './clarificationManager'
import {
  applyRecoveryToSession,
  planConversationRecovery,
  withRecoveryPreamble,
} from './conversationRecovery'
import {
  loadMultiTurnSession,
  resetMultiTurnSessions,
  saveMultiTurnSession,
} from './conversationMemoryStore'
import {
  appendSessionTurn,
  setSessionTopicGoal,
} from './conversationSession'
import { summarizeConversation } from './conversationSummarizer'
import { detectConversationTopic } from './topicDetector'
import { trackConversationTurn } from './conversationTracker'
import {
  clamp01,
  confidenceBand,
  type ConversationKnownFacts,
  type ConversationLocale,
} from './types'
import {
  isoNow,
  uniqueStrings,
  type MultiTurnConversationSession,
  type MultiTurnManagerInput,
  type MultiTurnManagerResult,
  type UserCorrectionRecord,
} from './memoryTypes'

export const MULTI_TURN_CONVERSATION_FEATURE_ID =
  'ai.multi_turn_conversation' as const

export function isMultiTurnConversationEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(MULTI_TURN_CONVERSATION_FEATURE_ID)
}

export interface MultiTurnTurnLike {
  reply: string
  memory: unknown
  tripPlan: unknown
  meta: Record<string, unknown> | object
  toolBatch: unknown
}

export interface MultiTurnTurnOptions {
  userText: string
  conversationId: string
  sessionId?: string
  enabled?: boolean
  conversationOrchestratorEnabled?: boolean
  signal?: AbortSignal
  now?: Date
}

function resolveLocale(value: unknown): ConversationLocale {
  return value === 'en' ? 'en' : 'ar'
}

function mergeFactField<T>(
  previous: T | null | undefined,
  next: T | null | undefined,
): T | null | undefined {
  if (next === undefined) return previous
  if (next === null) return previous ?? null
  return next
}

function applyFactsWithCorrections(
  session: MultiTurnConversationSession,
  incoming: ConversationKnownFacts,
  turnNumber: number,
  now?: Date,
): MultiTurnConversationSession {
  const corrections: UserCorrectionRecord[] = [...session.userCorrections]
  const at = isoNow(now)

  const record = (
    field: string,
    previousValue: string | null | undefined,
    nextValue: string | number | null | undefined,
  ) => {
    if (nextValue === undefined || nextValue === null) return
    const prev =
      previousValue === undefined || previousValue === null
        ? null
        : String(previousValue)
    const next = String(nextValue)
    if (prev != null && prev !== next) {
      corrections.push({
        field,
        previousValue: prev,
        nextValue: next,
        turnNumber,
        at,
      })
    }
  }

  record('destination', session.destinationFacts.destination, incoming.destination)
  record(
    'budgetAmount',
    session.strategyFacts.budgetAmount != null
      ? String(session.strategyFacts.budgetAmount)
      : null,
    incoming.budgetAmount,
  )
  record(
    'durationDays',
    session.strategyFacts.durationDays != null
      ? String(session.strategyFacts.durationDays)
      : null,
    incoming.durationDays,
  )
  record(
    'adults',
    session.travelerFacts.adults != null ? String(session.travelerFacts.adults) : null,
    incoming.adults,
  )

  const interests = uniqueStrings([
    ...(session.travelerFacts.interests ?? []),
    ...(incoming.interests ?? []),
  ])

  return {
    ...session,
    destinationFacts: {
      ...session.destinationFacts,
      destination: mergeFactField(
        session.destinationFacts.destination,
        incoming.destination,
      ),
      compareWith: mergeFactField(
        session.destinationFacts.compareWith,
        incoming.compareWith,
      ),
      destinationNotes: [...(session.destinationFacts.destinationNotes ?? [])],
    },
    strategyFacts: {
      ...session.strategyFacts,
      budgetAmount: mergeFactField(
        session.strategyFacts.budgetAmount,
        incoming.budgetAmount,
      ),
      budgetCurrency: mergeFactField(
        session.strategyFacts.budgetCurrency,
        incoming.budgetCurrency,
      ),
      durationDays: mergeFactField(
        session.strategyFacts.durationDays,
        incoming.durationDays,
      ),
      monthHint: mergeFactField(
        session.strategyFacts.monthHint,
        incoming.monthHint,
      ),
      strategyNotes: [...(session.strategyFacts.strategyNotes ?? [])],
    },
    travelerFacts: {
      ...session.travelerFacts,
      adults: mergeFactField(session.travelerFacts.adults, incoming.adults),
      children: mergeFactField(session.travelerFacts.children, incoming.children),
      origin: mergeFactField(session.travelerFacts.origin, incoming.origin),
      tripPurpose: mergeFactField(
        session.travelerFacts.tripPurpose,
        incoming.tripPurpose,
      ),
      interests,
      travelerNotes: [...(session.travelerFacts.travelerNotes ?? [])],
    },
    userCorrections: corrections.slice(-40),
    updatedAt: at,
  }
}

function knownFromSession(session: MultiTurnConversationSession): ConversationKnownFacts {
  return {
    destination: session.destinationFacts.destination ?? null,
    origin: session.travelerFacts.origin ?? null,
    budgetAmount: session.strategyFacts.budgetAmount ?? null,
    budgetCurrency: session.strategyFacts.budgetCurrency ?? null,
    durationDays: session.strategyFacts.durationDays ?? null,
    adults: session.travelerFacts.adults ?? null,
    children: session.travelerFacts.children ?? null,
    monthHint: session.strategyFacts.monthHint ?? null,
    interests: [...(session.travelerFacts.interests ?? [])],
    tripPurpose: session.travelerFacts.tripPurpose ?? null,
    compareWith: session.destinationFacts.compareWith ?? null,
  }
}

function spokenFrom(reply: string): string {
  return reply.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0]?.slice(0, 360) ?? reply
}

/**
 * Core multi-turn conversation management (no production planning).
 */
export async function runMultiTurnManager(
  input: MultiTurnManagerInput,
): Promise<MultiTurnManagerResult> {
  if (!isMultiTurnConversationEnabled({ enabled: input.enabled })) {
    throw new Error('multi_turn_conversation_disabled')
  }

  const locale = input.locale === 'en' ? 'en' : 'ar'
  const conversationId = input.conversationId.trim() || 'conversation'
  const userText = input.userText.trim()
  const now = input.now

  let session =
    loadMultiTurnSession(conversationId, {
      sessionId: input.sessionId,
      locale,
      createIfMissing: true,
    }) ?? ({ conversationId } as MultiTurnConversationSession)

  const topic = detectConversationTopic(userText, {
    locale,
    previousTopic: session.conversationTopic,
  })
  const tracked = trackConversationTurn({ userText, topic, session })

  // New trip: keep corrections history but clear active trip slots (append-only notes).
  if (tracked.event === 'new_trip') {
    session = {
      ...session,
      tripGoal: null,
      destinationFacts: {
        ...session.destinationFacts,
        destination: null,
        compareWith: null,
        destinationNotes: [
          ...(session.destinationFacts.destinationNotes ?? []),
          `new_trip@${session.turnNumber + 1}`,
        ],
      },
      strategyFacts: {
        ...session.strategyFacts,
        budgetAmount: null,
        durationDays: null,
        strategyNotes: [
          ...(session.strategyFacts.strategyNotes ?? []),
          `new_trip@${session.turnNumber + 1}`,
        ],
      },
      pendingClarification: null,
      missingInformation: [],
    }
  }

  const extracted = extractKnownFactsFromText(userText)
  const nextTurnNumber = session.turnNumber + 1
  session = applyFactsWithCorrections(session, extracted, nextTurnNumber, now)

  if (
    session.pendingClarification
    && (
      tracked.event === 'resuming'
      || tracked.isCorrection
      || tracked.changedFields.length > 0
      || tracked.event === 'follow_up'
    )
  ) {
    session = resolvePendingClarification(session, now)
  }

  session = setSessionTopicGoal(session, {
    topic,
    activeGoal: topic,
    tripGoal: session.destinationFacts.destination
      ? `trip:${session.destinationFacts.destination}`
      : session.tripGoal,
    now,
  })

  const recovery = planConversationRecovery({
    session,
    event: tracked.event,
    userText,
    locale,
  })
  session = applyRecoveryToSession(session, recovery)

  session = appendSessionTurn(
    session,
    {
      role: 'user',
      text: userText,
      topic,
      event: tracked.event,
      at: isoNow(now),
    },
    now,
  )

  const orchestratorOn = isConversationOrchestratorEnabled({
    enabled: input.conversationOrchestratorEnabled,
  })

  let reply = (input.productionReply ?? '').trim()
  let confidence = 0.5
  let pendingFromOrchestrator: string | null = null

  if (orchestratorOn) {
    const orchestrated = await tryRunConversationOrchestrator({
      conversationId,
      userText,
      locale,
      format: 'consultant',
      known: knownFromSession(session),
      tripPlan: input.tripPlan,
      requirements: input.requirements,
      toolResults: input.toolResults,
      signal: input.signal,
      enabled: true,
      now,
    })
    if (orchestrated) {
      reply = orchestrated.reply
      confidence = orchestrated.confidence
      pendingFromOrchestrator = orchestrated.clarificationQuestion
    }
  }

  const clarification = decideClarification({
    session,
    locale,
    confidenceHint: confidence,
  })
  confidence = clamp01(clarification.confidence)
  session = applyClarificationToSession(session, clarification, now)

  // Clarification rules: low confidence / missing info → exactly one question.
  // High confidence → never interrupt (keep answer).
  if (clarification.shouldClarify && clarification.question) {
    if (clarification.reason === 'low_confidence' || confidence < 0.35) {
      reply = clarification.question
    } else if (!reply) {
      reply = clarification.question
    } else if (!reply.includes(clarification.question)) {
      reply = `${reply}\n\n${
        locale === 'ar' ? 'سؤال واحد للتوضيح:' : 'One quick clarification:'
      } ${clarification.question}`
    }
  } else if (pendingFromOrchestrator && confidence < 0.7) {
    session = {
      ...session,
      pendingClarification: pendingFromOrchestrator,
    }
  }

  if (!reply) {
    reply =
      locale === 'ar'
        ? 'أنا معك — شاركني وجهتك أو ميزانيتك وسأبني الخطوة التالية.'
        : 'I’m with you — share a destination or budget and I’ll take the next step.'
  }

  reply = withRecoveryPreamble(reply, recovery)

  session = appendSessionTurn(
    session,
    {
      role: 'assistant',
      text: reply,
      topic,
      event: tracked.event,
      at: isoNow(now),
    },
    now,
  )

  const summarized = summarizeConversation(session, now)
  session = summarized.session
  saveMultiTurnSession(session)

  const band = confidenceBand(confidence)
  return {
    enabled: true,
    conversationId: session.conversationId,
    sessionId: session.sessionId,
    turnNumber: session.turnNumber,
    topic,
    event: tracked.event,
    activeGoal: session.activeGoal,
    tripGoal: session.tripGoal,
    confidence,
    confidenceBand: band,
    reply,
    spokenText: spokenFrom(reply),
    pendingClarification: session.pendingClarification,
    missingInformation: [...session.missingInformation],
    session,
    summarized: summarized.summarized,
    recovered: recovery.recovered,
  }
}

export async function tryRunMultiTurnManager(
  input: MultiTurnManagerInput,
): Promise<MultiTurnManagerResult | null> {
  if (!isMultiTurnConversationEnabled({ enabled: input.enabled })) return null
  try {
    return await runMultiTurnManager({ ...input, enabled: true })
  } catch {
    return null
  }
}

/**
 * planTurn enrichment: multi-turn continuity above Conversation Orchestrator.
 * Preserves production tripPlan / memory; may replace conversational reply text.
 */
export async function enrichTurnWithMultiTurnManager<T extends MultiTurnTurnLike>(
  turn: T,
  options: MultiTurnTurnOptions,
): Promise<T> {
  if (!isMultiTurnConversationEnabled({ enabled: options.enabled })) {
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

    // Seed session from production requirements once (append / corrections win later).
    const seed = loadMultiTurnSession(options.conversationId, {
      sessionId: options.sessionId,
      locale: resolveLocale(memory.locale),
      createIfMissing: true,
    })
    if (seed && seed.turnNumber === 0) {
      const seeded = applyFactsWithCorrections(
        seed,
        {
          destination: req.destination ?? req.destinations?.[0] ?? null,
          origin: req.origin ?? null,
          budgetAmount: req.budgetAmount ?? null,
          budgetCurrency: req.budgetCurrency ?? null,
          durationDays: req.durationDays ?? null,
          adults: req.travelers ?? null,
          interests: req.interests?.length ? [...req.interests] : undefined,
          tripPurpose: req.tripPurpose ?? req.travelerType ?? null,
        },
        0,
        options.now,
      )
      saveMultiTurnSession(seeded)
    }

    const managed = await runMultiTurnManager({
      conversationId: options.conversationId,
      sessionId: options.sessionId,
      userText: options.userText || turn.reply || '',
      locale: resolveLocale(memory.locale),
      productionReply: turn.reply,
      tripPlan: turn.tripPlan ?? undefined,
      requirements: req,
      toolResults,
      signal: options.signal,
      enabled: true,
      conversationOrchestratorEnabled: options.conversationOrchestratorEnabled,
      now: options.now,
    })

    return {
      ...turn,
      reply: managed.reply || turn.reply,
      meta: {
        ...(turn.meta as Record<string, unknown>),
        spokenText: managed.spokenText || (turn.meta as { spokenText?: string }).spokenText,
        multiTurnConversation: {
          enabled: true as const,
          conversationId: managed.conversationId,
          sessionId: managed.sessionId,
          turnNumber: managed.turnNumber,
          topic: managed.topic,
          event: managed.event,
          activeGoal: managed.activeGoal,
          tripGoal: managed.tripGoal,
          confidence: managed.confidence,
          confidenceBand: managed.confidenceBand,
          pendingClarification: managed.pendingClarification,
          missingInformation: [...managed.missingInformation],
          summarized: managed.summarized,
          recovered: managed.recovered,
        },
      },
    }
  } catch {
    return turn
  }
}

export const MultiTurnManager = {
  featureId: MULTI_TURN_CONVERSATION_FEATURE_ID,
  run: runMultiTurnManager,
  tryRun: tryRunMultiTurnManager,
  enrichTurn: enrichTurnWithMultiTurnManager,
  isEnabled: isMultiTurnConversationEnabled,
  resetSessions: resetMultiTurnSessions,
}
