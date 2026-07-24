/**
 * Proactive Travel Advisor — Phase 3 Stage 3.
 *
 * Recognizes opportunities to help the traveler. Recommendations only.
 * Never modifies trip planning, itineraries, pricing, or conversation text.
 * Additive; gated by `ai.proactive_advisor` (default OFF).
 * Output: meta.proactiveAdvisor only.
 */

import { buildProactiveContext } from './proactiveContext'
import { detectProactiveSignals } from './proactiveDetector'
import { buildProactiveRecommendations } from './proactiveRecommendation'
import { rankProactiveRecommendations } from './proactivePriority'
import {
  DEFAULT_MAX_PROACTIVE_RECOMMENDATIONS,
  isProactiveAdvisorEnabled,
  PROACTIVE_ADVISOR_FEATURE_ID,
} from './proactiveRegistry'
import type {
  ProactiveAdvisorInput,
  ProactiveAdvisorMetaSnapshot,
  ProactiveAdvisorResult,
  ProactiveLocale,
} from './types'

export interface ProactiveTurnLike {
  reply: string
  memory: unknown
  tripPlan: unknown
  meta: Record<string, unknown> | object
  toolBatch?: unknown
}

export interface ProactiveTurnOptions {
  userText: string
  conversationId: string
  enabled?: boolean
  now?: Date
  maxRecommendations?: number
}

function resolveLocale(value: unknown): ProactiveLocale {
  return value === 'en' ? 'en' : 'ar'
}

function readUnified(meta: Record<string, unknown>): unknown {
  return meta.consultantResponse ?? null
}

function readMultiTurn(meta: Record<string, unknown>): unknown {
  return meta.multiTurnConversation ?? null
}

function readPipelineBags(meta: Record<string, unknown>): {
  traveler?: unknown
  destination?: unknown
  strategy?: unknown
} {
  const pipeline = meta.consultantPipeline as
    | { traveler?: unknown; destination?: unknown; strategy?: unknown }
    | undefined
  return {
    traveler: pipeline?.traveler,
    destination: pipeline?.destination,
    strategy: pipeline?.strategy,
  }
}

/**
 * Core proactive advisor (read-only). Returns recommendation package only.
 */
export function runProactiveAdvisor(
  input: ProactiveAdvisorInput,
): ProactiveAdvisorResult {
  if (!isProactiveAdvisorEnabled({ enabled: input.enabled })) {
    throw new Error('proactive_advisor_disabled')
  }

  const started = Date.now()
  const context = buildProactiveContext(input)
  const detected = detectProactiveSignals(context)
  const built = buildProactiveRecommendations({ detected, context })
  const max = input.maxRecommendations ?? DEFAULT_MAX_PROACTIVE_RECOMMENDATIONS
  const recommendations = rankProactiveRecommendations(built, max)

  return {
    enabled: true,
    conversationId: context.conversationId,
    recommendations,
    signalsDetected: [...new Set(detected.map((d) => d.signal))],
    durationMs: Math.max(0, Date.now() - started),
  }
}

export function tryRunProactiveAdvisor(
  input: ProactiveAdvisorInput,
): ProactiveAdvisorResult | null {
  if (!isProactiveAdvisorEnabled({ enabled: input.enabled })) return null
  try {
    return runProactiveAdvisor({ ...input, enabled: true })
  } catch {
    return null
  }
}

function toMetaSnapshot(result: ProactiveAdvisorResult): ProactiveAdvisorMetaSnapshot {
  return {
    enabled: true,
    conversationId: result.conversationId,
    recommendationCount: result.recommendations.length,
    recommendations: result.recommendations,
    signalsDetected: [...result.signalsDetected],
    durationMs: result.durationMs,
  }
}

/**
 * planTurn enrichment: attach meta.proactiveAdvisor only.
 * Identity for reply / tripPlan / memory / other meta keys.
 */
export function enrichTurnWithProactiveAdvisor<T extends ProactiveTurnLike>(
  turn: T,
  options: ProactiveTurnOptions,
): T {
  if (!isProactiveAdvisorEnabled({ enabled: options.enabled })) {
    return turn
  }

  try {
    const memory = turn.memory as {
      locale?: string
      requirements?: unknown
    }
    const meta = turn.meta as Record<string, unknown>
    const bags = readPipelineBags(meta)

    const result = runProactiveAdvisor({
      locale: resolveLocale(memory.locale),
      conversationId: options.conversationId,
      userText: options.userText,
      memoryContext: memory,
      travelerUnderstanding: bags.traveler,
      destinationUnderstanding: bags.destination,
      strategySummary: bags.strategy,
      unifiedResponse: readUnified(meta),
      multiTurnSnapshot: readMultiTurn(meta),
      enabled: true,
      now: options.now,
      maxRecommendations: options.maxRecommendations,
    })

    return {
      ...turn,
      // Explicitly preserve production fields
      reply: turn.reply,
      tripPlan: turn.tripPlan,
      memory: turn.memory,
      meta: {
        ...meta,
        proactiveAdvisor: toMetaSnapshot(result),
      },
    }
  } catch {
    return turn
  }
}

export const ProactiveAdvisor = {
  featureId: PROACTIVE_ADVISOR_FEATURE_ID,
  run: runProactiveAdvisor,
  tryRun: tryRunProactiveAdvisor,
  enrichTurn: enrichTurnWithProactiveAdvisor,
  isEnabled: isProactiveAdvisorEnabled,
}
