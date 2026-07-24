/**
 * Evolution Sprint 6 — RecommendationRevision
 * Revise a prior package with new candidates — keeps revision linkage.
 */

import { buildRecommendationPackage } from './recommendationBuilder'
import type {
  RecommendationEngineInput,
  RecommendationPackage,
} from './recommendationTypes'

export function reviseRecommendation(
  previous: RecommendationPackage,
  input: Omit<RecommendationEngineInput, 'previous' | 'revisionReason'> & {
    revisionReason?: string | null
  },
): RecommendationPackage {
  return buildRecommendationPackage({
    ...input,
    previous,
    revisionReason:
      input.revisionReason
      ?? `Revised from ${previous.id} after updated candidates/evidence.`,
    locale: input.locale ?? previous.locale,
  })
}

export const RecommendationRevision = {
  revise: reviseRecommendation,
}
