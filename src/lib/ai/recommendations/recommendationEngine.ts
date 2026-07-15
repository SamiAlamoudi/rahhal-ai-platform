/**
 * Phase AA-compatible RecommendationEngine foundation for Phase AB.
 * Deterministic scoring; no external LLM calls.
 */

import type { PreferenceWeights } from '../preferences/types'
import { createRankingEngine } from '../ranking/rankingEngine'
import type { RankingEngine } from '../ranking/types'
import type {
  RecommendationCandidate,
  RecommendationEngine,
  RecommendationRequest,
  RecommendationResult,
} from './types'

function personalizationFit(
  kind: RecommendationCandidate['kind'],
  profile: RecommendationRequest['profile'],
): number {
  if (!profile) return 0.5
  if (kind === 'hotel') {
    return profile.hotel.preferCentral || profile.hotel.preferBreakfast ? 0.7 : 0.55
  }
  if (kind === 'flight') {
    return profile.airline.preferDirect ? 0.75 : 0.55
  }
  if (kind === 'itinerary') {
    return profile.travelStyle.pace === 'balanced' ? 0.65 : 0.55
  }
  return 0.5
}

export class DefaultRecommendationEngine implements RecommendationEngine {
  private readonly ranking: RankingEngine

  constructor(ranking: RankingEngine = createRankingEngine()) {
    this.ranking = ranking
  }

  recommend(request: RecommendationRequest): RecommendationResult {
    const weights: PreferenceWeights | undefined = request.profile?.weights
    const ranked = this.ranking.rank({
      items: request.candidates.map((c) => ({
        id: c.id,
        kind: c.kind,
        baseScore: c.baseScore,
        price: c.price,
        comfort: c.comfort,
        timeEfficiency: c.timeEfficiency,
        rating: c.rating,
        personalizationFit: personalizationFit(c.kind, request.profile),
        meta: { title: c.title },
      })),
      weights,
      locale: request.locale,
    })

    const limit = Math.max(1, request.maxResults ?? 3)
    const top = ranked.slice(0, limit)
    const titleById = new Map(request.candidates.map((c) => [c.id, c.title]))

    const toCandidate = (item: (typeof ranked)[number], rejected: string[]): RecommendationCandidate => ({
      id: item.id,
      kind: item.kind,
      title: titleById.get(item.id) ?? item.id,
      score: item.rankScore,
      confidence: item.confidence,
      whySelected: item.explanation,
      whyAlternativesRejected: rejected,
      payload: item.meta,
    })

    const primary = top[0]
      ? toCandidate(
        top[0],
        top.slice(1).map((a) => `${titleById.get(a.id) ?? a.id} ranked lower (${a.rankScore})`),
      )
      : null

    const alternatives = top.slice(1).map((item) =>
      toCandidate(item, primary ? [`Primary choice ${primary.title} scores higher`] : []),
    )

    const overallConfidence = primary
      ? Number(((primary.confidence + (alternatives[0]?.confidence ?? primary.confidence)) / 2).toFixed(4))
      : 0

    return {
      primary,
      alternatives,
      overallConfidence,
      explanations: primary?.whySelected ?? [],
      ranked,
    }
  }
}

export function createRecommendationEngine(): RecommendationEngine {
  return new DefaultRecommendationEngine()
}
