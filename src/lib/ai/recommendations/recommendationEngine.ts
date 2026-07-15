/**
 * Phase AC — RecommendationEngine v1.
 * Backward compatible with Phase AB recommend() while adding recommendV1().
 */

import type { PersonalizationProfile } from '../preferences/types'
import { createRankingEngine } from '../ranking/rankingEngine'
import type { RankingEngine } from '../ranking/types'
import type {
  RecommendV1Request,
  RecommendV1Result,
  Recommendation,
  RecommendationContext,
} from './models'
import { scoreCandidate, toRecommendationScore } from './scoring'
import type {
  RecommendationCandidate,
  RecommendationEngine as RecommendationEngineContract,
  RecommendationRequest,
  RecommendationResult,
} from './types'

function personalizationFit(
  kind: RecommendationCandidate['kind'],
  profile: PersonalizationProfile | null | undefined,
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

export class RecommendationEngine implements RecommendationEngineContract {
  private readonly ranking: RankingEngine
  private profile: PersonalizationProfile | null

  constructor(
    ranking: RankingEngine = createRankingEngine(),
    profile: PersonalizationProfile | null = null,
  ) {
    this.ranking = ranking
    this.profile = profile
  }

  setProfile(profile: PersonalizationProfile | null): void {
    this.profile = profile
  }

  getProfile(): PersonalizationProfile | null {
    return this.profile
  }

  /** Phase AC primary API. */
  recommendV1(request: RecommendV1Request): RecommendV1Result {
    const profile = this.profile
    const scored = request.candidates.map((candidate) =>
      scoreCandidate(candidate, request.context, profile, profile?.weights),
    )

    // Deterministic weighted ranking + tie-breakers.
    scored.sort((a, b) => {
      if (b.overall01 !== a.overall01) return b.overall01 - a.overall01
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      if (b.components.budgetFit !== a.components.budgetFit) {
        return b.components.budgetFit - a.components.budgetFit
      }
      return a.candidate.id.localeCompare(b.candidate.id)
    })

    const limit = Math.max(1, request.maxResults ?? (scored.length || 1))
    const top = scored.slice(0, Math.min(limit, scored.length))
    const explicit = new Set(request.explicitPreferences ?? [])
    const inferred = new Set(request.inferredPreferences ?? [])

    const recommendations: Recommendation[] = top.map((row, index) => {
      const matched = [...row.matchedPreferences]
      const unmatched = [...row.unmatchedPreferences]
      for (const key of explicit) {
        if (!matched.includes(`explicit:${key}`) && !unmatched.includes(`explicit:${key}`)) {
          // track explicit keys requested in context even if not component-matched
          if (matched.some((m) => m.includes(key)) || unmatched.some((u) => u.includes(key))) {
            matched.push(`explicit:${key}`)
          }
        }
      }
      for (const key of inferred) {
        if (matched.some((m) => m.includes(key))) matched.push(`inferred:${key}`)
      }
      const score = toRecommendationScore(row)
      return {
        id: `rec_${row.candidate.id}`,
        kind: row.candidate.kind,
        title: row.candidate.title,
        candidateId: row.candidate.id,
        rank: index + 1,
        score,
        confidence: score.confidence,
        reasons: row.reasons,
        matchedPreferences: [...new Set(matched)].sort(),
        unmatchedPreferences: [...new Set(unmatched)].sort(),
      }
    })

    const primary = recommendations[0] ?? null
    const overallConfidence = primary
      ? Number((
        (primary.confidence + (recommendations[1]?.confidence ?? primary.confidence)) / 2
      ).toFixed(4))
      : 0

    return {
      recommendations,
      primary,
      overallConfidence,
    }
  }

  /** Phase AB compatible facade. */
  recommend(request: RecommendationRequest): RecommendationResult {
    const context: RecommendationContext = {
      destination: request.destination,
      destinations: request.destinations ?? [request.destination],
      locale: request.locale ?? 'en',
      tripDurationDays: null,
      travelMonth: null,
      season: null,
      budgetAmount: request.profile?.budget.typicalTripBudget ?? null,
      budgetCurrency: request.profile?.budget.currency ?? null,
      travelerType: request.profile?.traveler.travelerTypes[0] ?? null,
      travelStyle: request.profile?.travelStyle.style ?? null,
      interests: request.profile?.travelStyle.interests ?? [],
    }

    if (request.profile) this.profile = request.profile

    const v1 = this.recommendV1({
      context,
      maxResults: request.maxResults ?? 3,
      candidates: request.candidates.map((c) => ({
        id: c.id,
        kind: c.kind,
        title: c.title,
        estimatedCost: c.price,
        popularity: null,
        baseScore: c.baseScore,
        tags: [],
        travelStyles: request.profile ? [request.profile.travelStyle.style] : [],
      })),
    })

    // Also run AB ranking path for ranked[] field compatibility.
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
      weights: request.profile?.weights,
      locale: request.locale,
    })

    const titleById = new Map(request.candidates.map((c) => [c.id, c.title]))
    const toCandidate = (
      item: (typeof ranked)[number],
      rejected: string[],
    ): RecommendationCandidate => ({
      id: item.id,
      kind: item.kind,
      title: titleById.get(item.id) ?? item.id,
      score: item.rankScore,
      confidence: item.confidence,
      whySelected: item.explanation,
      whyAlternativesRejected: rejected,
      payload: item.meta,
    })

    const primaryRanked = ranked[0]
      ? toCandidate(
        ranked[0],
        ranked.slice(1).map((a) => `${titleById.get(a.id) ?? a.id} ranked lower (${a.rankScore})`),
      )
      : null

    return {
      primary: primaryRanked,
      alternatives: ranked.slice(1, request.maxResults ?? 3).map((item) =>
        toCandidate(item, primaryRanked ? [`Primary choice ${primaryRanked.title} scores higher`] : []),
      ),
      overallConfidence: v1.overallConfidence || (primaryRanked?.confidence ?? 0),
      explanations: [
        ...(primaryRanked?.whySelected ?? []),
        ...(v1.primary?.reasons.map((r) => r.message) ?? []),
      ],
      ranked,
    }
  }
}

/** @deprecated Prefer RecommendationEngine class; kept for Phase AB imports. */
export class DefaultRecommendationEngine extends RecommendationEngine {}

export function createRecommendationEngine(
  profile: PersonalizationProfile | null = null,
): RecommendationEngine {
  return new RecommendationEngine(createRankingEngine(), profile)
}
