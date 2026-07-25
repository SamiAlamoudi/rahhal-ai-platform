/**
 * Evolution Sprint 6 — RecommendationScorer + dimension evaluators.
 * Scores only from known candidate fields — unknown stays neutral, never invented.
 */

import {
  clamp01,
  clampScore,
  type RecommendationCandidate,
  type RecommendationEngineInput,
  type ScoredDimensions,
} from './recommendationTypes'

function knownDestinations(c: RecommendationCandidate): number {
  return c.destinations?.length ?? 0
}

function missingCount(c: RecommendationCandidate): number {
  return c.missingData?.length ?? 0
}

export function analyzeValue(
  c: RecommendationCandidate,
  hints?: RecommendationEngineInput['travelerHints'],
): { score: number; notes: string[] } {
  const notes: string[] = []
  let score = 40
  const conf = clamp01(c.confidence ?? 0.5)
  score += conf * 25
  score += clampScore(c.score ?? 50) * 0.25
  if (knownDestinations(c) > 0) {
    score += 8
    notes.push('Destination direction is stated.')
  } else {
    notes.push('No destination stated — value remains provisional.')
  }
  if (typeof c.budget?.amount === 'number') {
    score += 6
    notes.push('Budget amount is known.')
  }
  if (hints?.preferValueOverCheapest && c.budget?.stance === 'value_seeking') {
    score += 5
    notes.push('Aligns with value-over-cheapest traveler hint.')
  }
  if (hints?.favorDestinations?.length && c.destinations?.some((d) =>
    hints.favorDestinations!.some((f) => f.toLowerCase() === d.toLowerCase()),
  )) {
    score += 8
    notes.push('Matches traveler destination affinity hint.')
  }
  score -= missingCount(c) * 3
  return { score: clampScore(score), notes }
}

export function evaluateRisk(c: RecommendationCandidate): { score: number; notes: string[] } {
  // Higher score = more risk (penalty input)
  const notes: string[] = [...(c.risks ?? [])]
  let score = 20
  score += (c.risks?.length ?? 0) * 12
  if ((c.travelerProfile?.riskTolerance ?? '') === 'low' && (c.risks?.length ?? 0) > 0) {
    score += 15
    notes.push('Low risk tolerance with stated risk notes.')
  }
  if (missingCount(c) >= 4) {
    score += 10
    notes.push('High missing-information load increases decision risk.')
  }
  if (!(c.destinations?.length) && c.intent !== 'discover') {
    score += 8
    notes.push('No destination outside discovery mode.')
  }
  return { score: clampScore(score), notes: notes.slice(0, 6) }
}

export function evaluateBenefits(c: RecommendationCandidate): { score: number; notes: string[] } {
  const notes: string[] = []
  let score = 35
  if (c.destinations?.length) {
    score += 12
    notes.push(`Clear destination option: ${c.destinations.join(', ')}.`)
  }
  if (typeof c.dates?.durationDays === 'number') {
    score += 8
    notes.push(`Duration known (${c.dates.durationDays} days).`)
  }
  if (c.travelerProfile?.purpose) {
    score += 8
    notes.push(`Purpose stated: ${c.travelerProfile.purpose}.`)
  }
  if ((c.constraints?.hard?.length ?? 0) > 0) {
    score += 5
    notes.push('Hard constraints provide planning clarity.')
  }
  if (c.whyExists) notes.push(`Scenario exists because: ${c.whyExists}`)
  return { score: clampScore(score), notes: notes.slice(0, 6) }
}

export function evaluateTradeoffs(c: RecommendationCandidate): { score: number; notes: string[] } {
  const notes = [...(c.tradeoffs ?? [])]
  let score = 30 + (c.tradeoffs?.length ?? 0) * 10
  if ((c.constraints?.hard?.length ?? 0) >= 3) {
    score += 10
    notes.push('Many hard constraints reduce flexibility.')
  }
  if (c.dates?.flexible === false && typeof c.dates.durationDays === 'number') {
    notes.push('Fixed duration reduces date flexibility.')
    score += 5
  }
  return { score: clampScore(score), notes: notes.slice(0, 6) }
}

export function analyzeOpportunityCost(
  c: RecommendationCandidate,
  peers: RecommendationCandidate[],
): { score: number; notes: string[] } {
  const notes: string[] = []
  let score = 25
  const peerDest = peers
    .filter((p) => p.id !== c.id)
    .flatMap((p) => p.destinations ?? [])
  const uniquePeers = [...new Set(peerDest)].filter(
    (d) => !(c.destinations ?? []).some((x) => x.toLowerCase() === d.toLowerCase()),
  )
  if (uniquePeers.length) {
    score += Math.min(30, uniquePeers.length * 10)
    notes.push(`Choosing this forgoes exploring: ${uniquePeers.slice(0, 3).join(', ')}.`)
  }
  if (!(c.destinations?.length) && peers.some((p) => (p.destinations?.length ?? 0) > 0)) {
    score += 15
    notes.push('Open plan forgoes a more concrete peer destination.')
  }
  if ((c.score ?? 0) + 15 < Math.max(...peers.map((p) => p.score ?? 0), 0)) {
    score += 12
    notes.push('A peer candidate carries a materially higher plan score.')
  }
  return { score: clampScore(score), notes: notes.slice(0, 5) }
}

export function scoreCandidate(
  c: RecommendationCandidate,
  peers: RecommendationCandidate[],
  hints?: RecommendationEngineInput['travelerHints'],
): ScoredDimensions & { valueNotes: string[]; riskNotes: string[]; benefitNotes: string[]; tradeoffNotes: string[]; opportunityNotes: string[] } {
  const value = analyzeValue(c, hints)
  const risk = evaluateRisk(c)
  const benefit = evaluateBenefits(c)
  const tradeoff = evaluateTradeoffs(c)
  const opportunity = analyzeOpportunityCost(c, peers)

  const composite = clampScore(
    value.score * 0.3
      + benefit.score * 0.25
      + (100 - risk.score) * 0.2
      + (100 - tradeoff.score) * 0.1
      + (100 - opportunity.score) * 0.15
      + clamp01(c.confidence ?? 0.5) * 10,
  )

  return {
    valueScore: value.score,
    riskScore: risk.score,
    benefitScore: benefit.score,
    tradeoffScore: tradeoff.score,
    opportunityCostScore: opportunity.score,
    compositeScore: composite,
    valueNotes: value.notes,
    riskNotes: risk.notes,
    benefitNotes: benefit.notes,
    tradeoffNotes: tradeoff.notes,
    opportunityNotes: opportunity.notes,
  }
}

export const RecommendationScorer = { scoreCandidate }
export const ValueAnalyzer = { analyze: analyzeValue }
export const RiskEvaluator = { evaluate: evaluateRisk }
export const BenefitEvaluator = { evaluate: evaluateBenefits }
export const TradeoffEvaluator = { evaluate: evaluateTradeoffs }
export const OpportunityCostAnalyzer = { analyze: analyzeOpportunityCost }
