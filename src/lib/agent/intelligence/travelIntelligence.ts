/**
 * Travel Intelligence Layer — Phase 3 Stage 4.
 *
 * Evaluates alternatives, trade-offs, confidence, and ranking.
 * Metadata only (`meta.travelIntelligence`). Never mutates planning.
 *
 * Isolated: NOT wired into planTurn. Call run/enrich explicitly when enabled.
 * Flag `ai.travel_intelligence` default OFF.
 */

import {
  buildIntelligenceContext,
  generateTravelAlternatives,
} from './alternativeGenerator'
import { calculateIntelligenceConfidence } from './confidenceEngine'
import { scoreAllDecisions } from './decisionScoring'
import {
  buildAlternativeJustifications,
  buildIntelligenceExplanation,
  buildIntelligenceMemoryAppend,
  buildKnowledgeReferences,
  buildTravelVoiceSummary,
} from './explanationBuilder'
import {
  isTravelIntelligenceEnabled,
  TRAVEL_INTELLIGENCE_FEATURE_ID,
} from './intelligenceRegistry'
import { rankTravelAlternatives } from './rankingEngine'
import { analyzeTravelTradeoffs } from './tradeoffAnalyzer'
import { compareTravelAlternatives } from './travelComparator'
import type {
  TravelIntelligenceInput,
  TravelIntelligenceMetaSnapshot,
  TravelIntelligenceResult,
} from './types'

export interface IntelligenceTurnLike {
  reply: string
  memory: unknown
  tripPlan: unknown
  meta: Record<string, unknown> | object
  toolBatch?: unknown
}

export interface IntelligenceTurnOptions {
  userText: string
  conversationId: string
  enabled?: boolean
  candidateDestinations?: string[]
  now?: Date
  maxAlternatives?: number
}

/**
 * Core intelligence evaluation (read-only). Returns metadata package only.
 */
export function runTravelIntelligence(
  input: TravelIntelligenceInput,
): TravelIntelligenceResult {
  if (!isTravelIntelligenceEnabled({ enabled: input.enabled })) {
    throw new Error('travel_intelligence_disabled')
  }

  const started = Date.now()
  const context = buildIntelligenceContext({
    locale: input.locale,
    conversationId: input.conversationId,
    userText: input.userText,
    memoryContext: input.memoryContext,
    travelerPreferences: input.travelerPreferences,
    conversationContext: input.conversationContext,
  })

  const alternatives = generateTravelAlternatives({
    context,
    candidateDestinations: input.candidateDestinations,
    maxAlternatives: input.maxAlternatives,
  })

  const comparisons = compareTravelAlternatives({ alternatives, context })
  const decisionScores = scoreAllDecisions({
    alternatives,
    comparisons,
    context,
  })
  const tradeoffs = analyzeTravelTradeoffs({
    alternatives,
    comparisons,
    locale: context.locale,
  })
  const confidence = calculateIntelligenceConfidence({
    context,
    alternatives,
    comparisons,
    decisionScores,
  })
  const justifications = buildAlternativeJustifications({
    alternatives,
    rankedPreview: decisionScores,
    context,
    tradeoffs,
  })
  const ranked = rankTravelAlternatives({
    alternatives,
    decisionScores,
    confidences: confidence.perAlternative,
    tradeoffs,
    justifications,
  })
  const explanation = buildIntelligenceExplanation({
    context,
    ranked,
    tradeoffs,
    overallConfidence: confidence.overallConfidence,
  })
  const voiceSummary = buildTravelVoiceSummary({
    explanation,
    locale: context.locale,
  })
  const knowledgeRefs = buildKnowledgeReferences(ranked)
  const memoryAppend = buildIntelligenceMemoryAppend({ ranked, context })

  return {
    enabled: true,
    conversationId: context.conversationId,
    alternatives,
    comparisons,
    tradeoffs,
    ranked,
    primaryId: ranked[0]?.alternativeId ?? null,
    overallConfidence: confidence.overallConfidence,
    explanation,
    voiceSummary,
    knowledgeRefs,
    memoryAppend,
    durationMs: Math.max(0, Date.now() - started),
  }
}

export function tryRunTravelIntelligence(
  input: TravelIntelligenceInput,
): TravelIntelligenceResult | null {
  if (!isTravelIntelligenceEnabled({ enabled: input.enabled })) return null
  try {
    return runTravelIntelligence({ ...input, enabled: true })
  } catch {
    return null
  }
}

function toMetaSnapshot(
  result: TravelIntelligenceResult,
): TravelIntelligenceMetaSnapshot {
  return {
    enabled: true,
    conversationId: result.conversationId,
    alternativeCount: result.alternatives.length,
    rankedCount: result.ranked.length,
    primaryId: result.primaryId,
    overallConfidence: result.overallConfidence,
    explanation: result.explanation,
    ranked: result.ranked,
    tradeoffs: result.tradeoffs,
    voiceSummary: result.voiceSummary,
    knowledgeRefs: result.knowledgeRefs,
    memoryAppend: result.memoryAppend,
    durationMs: result.durationMs,
  }
}

/**
 * Optional enrich helper: attaches meta.travelIntelligence only.
 * Identity for reply / tripPlan / memory / other meta.
 * NOT called from planTurn in this stage (isolated layer).
 */
export function enrichTurnWithTravelIntelligence<T extends IntelligenceTurnLike>(
  turn: T,
  options: IntelligenceTurnOptions,
): T {
  if (!isTravelIntelligenceEnabled({ enabled: options.enabled })) {
    return turn
  }

  try {
    const memory = turn.memory as {
      locale?: string
      requirements?: unknown
    }
    const meta = turn.meta as Record<string, unknown>

    const result = runTravelIntelligence({
      locale: memory.locale === 'en' ? 'en' : 'ar',
      conversationId: options.conversationId,
      userText: options.userText,
      memoryContext: memory,
      travelerPreferences: meta.multiTurnConversation ?? meta.proactiveAdvisor ?? null,
      conversationContext: meta.multiTurnConversation ?? null,
      candidateDestinations: options.candidateDestinations,
      enabled: true,
      now: options.now,
      maxAlternatives: options.maxAlternatives,
    })

    return {
      ...turn,
      reply: turn.reply,
      tripPlan: turn.tripPlan,
      memory: turn.memory,
      meta: {
        ...meta,
        travelIntelligence: toMetaSnapshot(result),
      },
    }
  } catch {
    return turn
  }
}

export const TravelIntelligence = {
  featureId: TRAVEL_INTELLIGENCE_FEATURE_ID,
  run: runTravelIntelligence,
  tryRun: tryRunTravelIntelligence,
  enrichTurn: enrichTurnWithTravelIntelligence,
  isEnabled: isTravelIntelligenceEnabled,
}
