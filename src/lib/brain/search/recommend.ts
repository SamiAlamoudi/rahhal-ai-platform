/**
 * Sprint 24 — Recommendation Engine over ranked SearchResults.
 */

import type {
  RecommendationCandidate,
  SearchRecommendation,
  SearchResult,
} from './types'

export type RecommendOptions = {
  maxAlternatives?: number
}

/**
 * Build top recommendation, alternatives, rejected list, reasoning, confidence.
 */
export function buildSearchRecommendation(
  ranked: SearchResult[],
  options: RecommendOptions = {},
): SearchRecommendation {
  const maxAlternatives = options.maxAlternatives ?? 3
  const accepted = ranked.filter((r) => !r.rejected)
  const rejectedRaw = ranked.filter((r) => r.rejected)

  const topResult = accepted[0] ?? null
  const top = topResult ? toCandidate(topResult) : null
  const alternatives = accepted.slice(1, 1 + maxAlternatives).map(toCandidate)
  const rejected = rejectedRaw.slice(0, 5).map(toCandidate)

  const reasoning: string[] = []
  if (top) {
    reasoning.push(`Selected ${top.kind} “${top.title}” with score ${top.score.toFixed(2)}`)
    reasoning.push(...top.reasons.slice(0, 3))
    if (alternatives.length) {
      reasoning.push(
        `${alternatives.length} alternative(s) retained after ranking`,
      )
    }
  } else {
    reasoning.push('No accepted candidates after ranking filters')
  }
  if (rejected.length) {
    reasoning.push(`${rejected.length} candidate(s) rejected (budget/filters)`)
  }

  const confidenceScore = top
    ? round4(
        (top.confidence +
          (alternatives[0]?.confidence ?? top.confidence) * 0.25 +
          (accepted.length > 1 ? 0.1 : 0)) /
          1.35,
      )
    : 0

  return {
    top,
    alternatives,
    rejected,
    reasoning,
    confidenceScore,
  }
}

function toCandidate(result: SearchResult): RecommendationCandidate {
  return {
    id: result.id,
    kind: result.option.kind,
    title: titleOf(result),
    score: result.score,
    confidence: result.confidence,
    option: result.option,
    reasons: result.rejected ? result.rejectReasons : result.reasons,
    factors: result.factors,
  }
}

function titleOf(result: SearchResult): string {
  const o = result.option
  switch (o.kind) {
    case 'flight':
      return `${o.airline} ${o.from}→${o.to}`
    case 'hotel':
      return o.name
    case 'transport':
      return `${o.mode} ${o.from}→${o.to}`
    case 'activity':
      return o.title
    case 'package':
      return o.title
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
