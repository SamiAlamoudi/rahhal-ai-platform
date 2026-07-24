/**
 * Phase 3 Stage 4 — Rank travel alternatives by decision score + confidence.
 */

import type {
  IntelligenceRankedRecommendation,
  TradeoffInsight,
  TravelAlternative,
} from './types'

export function rankTravelAlternatives(input: {
  alternatives: TravelAlternative[]
  decisionScores: Array<{ alternativeId: string; decisionScore: number }>
  confidences: Array<{ alternativeId: string; confidence: number }>
  tradeoffs: TradeoffInsight[]
  justifications: Array<{ alternativeId: string; justification: string }>
}): IntelligenceRankedRecommendation[] {
  const scoreById = new Map(
    input.decisionScores.map((s) => [s.alternativeId, s.decisionScore]),
  )
  const confById = new Map(
    input.confidences.map((c) => [c.alternativeId, c.confidence]),
  )
  const justById = new Map(
    input.justifications.map((j) => [j.alternativeId, j.justification]),
  )
  const tradeoffsById = new Map<string, string[]>()
  for (const t of input.tradeoffs) {
    for (const id of t.between) {
      const list = tradeoffsById.get(id) ?? []
      list.push(t.summary)
      tradeoffsById.set(id, list)
    }
  }

  const ordered = [...input.alternatives].sort((a, b) => {
    const sa = scoreById.get(a.id) ?? 0
    const sb = scoreById.get(b.id) ?? 0
    if (sb !== sa) return sb - sa
    const ca = confById.get(a.id) ?? 0
    const cb = confById.get(b.id) ?? 0
    return cb - ca
  })

  return ordered.map((alt, index) => ({
    rank: index + 1,
    alternativeId: alt.id,
    label: alt.label,
    destination: alt.destination,
    score: scoreById.get(alt.id) ?? 0,
    confidence: confById.get(alt.id) ?? 0,
    justification:
      justById.get(alt.id)
      ?? `Ranked by comparative fit for ${alt.destination}.`,
    tradeoffs: (tradeoffsById.get(alt.id) ?? []).slice(0, 3),
  }))
}

export const RankingEngine = {
  rank: rankTravelAlternatives,
}
