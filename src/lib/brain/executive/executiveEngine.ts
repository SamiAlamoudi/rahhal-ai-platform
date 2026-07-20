/**
 * Phase 2 — Travel Executive orchestration.
 * Single entry for context, memory, budget, rejection, optimization.
 */

import { getPreferenceEngine } from '../../ai/preferences'
import { toReasoningSnapshot } from '../../agent/reasoning'
import type { TravelReasoningResult } from '../../agent/reasoning/types'
import { buildExecutiveContext } from './contextBuilder'
import { collectBudgetWarnings } from './budgetIntelligence'
import { optimizeDiscoveryRanking } from './discoveryOptimizer'
import {
  applyRejectedDestinationsFilter,
  learnRejectedDestinations,
} from './rejectedDestinations'
import type { ExecutiveEnhancement, ExecutiveProcessInput } from './types'
import { isTravelExecutiveEnabled } from './feature'

export function processExecutiveIntelligence(
  input: ExecutiveProcessInput,
  options?: { enabled?: boolean },
): ExecutiveEnhancement {
  const enabled = isTravelExecutiveEnabled(options)
  const engine = getPreferenceEngine()

  const learnedRejections = enabled
    ? learnRejectedDestinations(input.userText, input.userId, engine)
    : []

  const freshProfile = engine.getProfile(input.userId)
  const context = buildExecutiveContext({
    memory: input.memory,
    understanding: input.understanding,
    intents: input.intents,
    profile: freshProfile,
    userText: input.userText,
  })

  if (!enabled || !input.reasoningResult) {
    return {
      context,
      reasoningResult: input.reasoningResult,
      optimizationAxis: context.optimizationAxis,
      learnedRejections,
      budgetWarnings: [],
    }
  }

  let reasoningResult: TravelReasoningResult = input.reasoningResult

  reasoningResult = applyRejectedDestinationsFilter(
    reasoningResult,
    context.rejectedDestinations,
    input.memory.locale,
  )

  reasoningResult = optimizeDiscoveryRanking(reasoningResult, context)

  const budgetWarnings = collectBudgetWarnings(reasoningResult, context)

  return {
    context,
    reasoningResult,
    optimizationAxis: context.optimizationAxis,
    learnedRejections,
    budgetWarnings,
  }
}

export function executiveReasoningSnapshot(result: TravelReasoningResult | null) {
  if (!result) return undefined
  return toReasoningSnapshot(result)
}
