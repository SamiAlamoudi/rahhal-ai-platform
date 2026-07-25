/**
 * Evolution Sprint 6 — AlternativeGenerator
 */

import type { RecommendationCandidate } from './recommendationTypes'

export function generateAlternatives(
  primaryId: string | null,
  ranked: Array<{ candidate: RecommendationCandidate; composite: number }>,
): Array<{
  candidateId: string
  label: string
  whyNotPrimary: string[]
  relativeScore: number
}> {
  return ranked
    .filter((r) => r.candidate.id !== primaryId)
    .slice(0, 4)
    .map((r) => ({
      candidateId: r.candidate.id,
      label: r.candidate.label,
      whyNotPrimary: [
        `Composite score ${r.composite} vs primary.`,
        ...(r.candidate.destinations?.length
          ? [`Alternative destinations: ${r.candidate.destinations.join(', ')}.`]
          : ['No destination stated on this alternative.']),
        ...(r.candidate.whyExists ? [`Exists because: ${r.candidate.whyExists}`] : []),
      ],
      relativeScore: r.composite,
    }))
}

export const AlternativeGenerator = { generate: generateAlternatives }
