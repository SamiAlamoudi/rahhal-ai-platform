/**
 * Evolution Sprint 2 — ReflectionPipeline
 *
 * Observe → update memory/state → invalidate affected nodes → re-score → refine.
 * Never rebuilds unaffected reasoning nodes from scratch.
 * Not wired into planTurn. CPU-only.
 */

import type { ConsultantLocale } from '../reasoning/consultantTypes'
import { isConsultantReflectionEnabled } from './reflectionFeature'
import { ConversationMemory, combinedUserText } from './conversationMemory'
import {
  TravelerState,
  applyTurnToState,
  changedSlotKeys,
  createInitialState,
} from './travelerState'
import { computeDirtyNodes } from './nodeInvalidation'
import { ConfidenceTracker, snapshotConfidence, latestOverallConfidence } from './confidenceTracker'
import { ClarificationPriority, buildClarificationQueue } from './clarificationPriority'
import {
  AssumptionTracker,
  invalidateAssumptionsOnTurn,
  syncAssumptions,
} from './assumptionTracker'
import { DecisionHistory, appendDecision } from './decisionHistory'
import {
  RecommendationRefiner,
  buildRecommendationRecord,
  refineReasonForChange,
} from './recommendationRefiner'
import { AlternativeExplorer, exploreAlternatives } from './alternativeExplorer'
import { ExplanationRevision, reviseExplanation } from './explanationRevision'
import { nodesToBundle, refreshDirtyNodes } from './nodeRefresh'
import {
  emptyNodes,
  isoNow,
  newId,
  toReasoningInput,
  type ReflectionPipelineResult,
  type ReflectionSession,
  type ReflectionTurnInput,
  type RecommendationRecord,
} from './reflectionTypes'

export function createReflectionSession(
  locale: ConsultantLocale = 'ar',
  now?: Date,
): ReflectionSession {
  const stamp = isoNow(now)
  return {
    id: newId('refl', now),
    createdAt: stamp,
    updatedAt: stamp,
    locale,
    turns: [],
    state: createInitialState(locale, now),
    nodes: emptyNodes(),
    confidenceHistory: [],
    assumptions: [],
    recommendations: [],
    decisionHistory: [],
    clarificationQueue: [],
    alternatives: [],
    lastExplanation: null,
  }
}

/**
 * Apply one traveler turn: incremental reflection (not a full cold rebuild when cache exists).
 */
export function reflectTurn(
  session: ReflectionSession,
  input: ReflectionTurnInput,
): ReflectionPipelineResult {
  const now = input.now ?? new Date()
  const locale: ConsultantLocale = input.locale ?? session.locale ?? 'ar'
  const isColdStart = session.recommendations.length === 0
    || Object.values(session.nodes).every((n) => n == null)

  const turn = ConversationMemory.appendUserTurn(
    session,
    input.userText,
    locale,
    input.knownDelta,
    now,
  )

  const slotsBefore = { ...session.state.slots }
  session.state = applyTurnToState(session.state, turn, now)
  session.locale = locale

  const changed = changedSlotKeys(slotsBefore, session.state.slots)
  const textOnlyRefine = changed.length === 0 && turn.text.trim().length > 0

  const { dirty, reused } = computeDirtyNodes({
    isColdStart,
    changedSlots: changed,
    textOnlyRefine,
  })

  session.assumptions = invalidateAssumptionsOnTurn(session.assumptions, turn, now)

  const reasoningInput = toReasoningInput(
    combinedUserText(session),
    session.state.slots,
    locale,
  )

  session.nodes = refreshDirtyNodes(reasoningInput, session.nodes, dirty)

  session.assumptions = syncAssumptions(session.assumptions, session.nodes, now)

  const previousRec: RecommendationRecord | null =
    session.recommendations[session.recommendations.length - 1] ?? null

  const reasonForChange = refineReasonForChange({
    isColdStart,
    changedSlots: changed as string[],
    refreshedNodes: dirty,
    previous: previousRec,
    current: session.nodes.recommendation,
  })

  const evidence = [
    ...turn.evidence,
    ...session.turns.filter((t) => t.role === 'user').flatMap((t) => t.evidence).slice(-12),
  ]

  const record = buildRecommendationRecord({
    nodes: session.nodes,
    assumptions: session.assumptions,
    evidence,
    refreshedNodes: dirty,
    reasonForChange,
    now,
  })

  const confidenceBefore = latestOverallConfidence(session.confidenceHistory)
  const confPoint = snapshotConfidence(session.nodes, reasonForChange, now)
  session.confidenceHistory.push(confPoint)

  if (record) {
    session.recommendations.push(record)
    session.decisionHistory = appendDecision(
      session.decisionHistory,
      record,
      previousRec ? confidenceBefore : null,
      now,
    )
  }

  session.clarificationQueue = buildClarificationQueue(
    record?.missingData ?? session.nodes.recommendation?.missingInformation ?? [],
    session.state.slots,
    session.state.priorities,
  )

  session.alternatives = exploreAlternatives({
    slots: session.state.slots,
    destination: session.nodes.destination,
    recommendation: record,
    priorAlternatives: session.alternatives,
  })

  const explanationRevision = reviseExplanation({
    locale,
    record,
    previous: previousRec,
    baseExplanation: session.nodes.explanation,
  })
  session.lastExplanation = session.nodes.explanation
  session.updatedAt = isoNow(now)

  return {
    session,
    refreshedNodes: dirty,
    reusedNodes: reused,
    latestRecommendation: record,
    clarificationQueue: session.clarificationQueue,
    explanationRevision,
    reasoningBundle: nodesToBundle(locale, session.nodes),
  }
}

/**
 * Gate-aware entry: returns null when feature flag is OFF (unless forced).
 */
export function tryReflectTurn(
  session: ReflectionSession,
  input: ReflectionTurnInput,
): ReflectionPipelineResult | null {
  if (!isConsultantReflectionEnabled({ enabled: input.enabled })) return null
  return reflectTurn(session, input)
}

export const ReflectionPipeline = {
  createSession: createReflectionSession,
  reflect: reflectTurn,
  tryReflect: tryReflectTurn,
}

// Re-export module facades for mission naming surface.
export {
  ConversationMemory,
  TravelerState,
  ConfidenceTracker,
  ClarificationPriority,
  RecommendationRefiner,
  AlternativeExplorer,
  AssumptionTracker,
  DecisionHistory,
  ExplanationRevision,
}
