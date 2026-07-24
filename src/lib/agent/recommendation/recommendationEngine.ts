/**
 * Evolution Sprint 6 — RecommendationEngine
 *
 * Expert consultant recommendations from plan candidates.
 * Explain, compare, justify, challenge — not mere ranking.
 * Not wired into planTurn. CPU-only.
 */

import { isRecommendationIntelligenceEnabled } from './recommendationFeature'
import { buildRecommendationPackage } from './recommendationBuilder'
import { buildFormats } from './recommendationNarrative'
import { compareCandidates } from './recommendationComparator'
import { reviseRecommendation } from './recommendationRevision'
import { summarizeRecommendation } from './recommendationSummary'
import type {
  RecommendationEngineInput,
  RecommendationEngineResult,
  RecommendationPackage,
} from './recommendationTypes'

export function runRecommendationEngine(
  input: RecommendationEngineInput,
): RecommendationEngineResult {
  const pkg = input.previous && input.revisionReason
    ? reviseRecommendation(input.previous, input)
    : buildRecommendationPackage(input)

  const formats = buildFormats(pkg)
  const compared: RecommendationEngineResult['compared'] = []
  const candidates = input.candidates ?? []
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      compared.push(compareCandidates(candidates[i]!, candidates[j]!, candidates))
    }
  }

  return { package: pkg, formats, compared }
}

export function tryRunRecommendationEngine(
  input: RecommendationEngineInput,
): RecommendationEngineResult | null {
  if (!isRecommendationIntelligenceEnabled({ enabled: input.enabled })) return null
  return runRecommendationEngine(input)
}

export const RecommendationEngine = {
  run: runRecommendationEngine,
  tryRun: tryRunRecommendationEngine,
  revise: (previous: RecommendationPackage, input: RecommendationEngineInput) =>
    reviseRecommendation(previous, {
      ...input,
      revisionReason: input.revisionReason ?? `Revised from ${previous.id}`,
    }),
  summarize: summarizeRecommendation,
}
