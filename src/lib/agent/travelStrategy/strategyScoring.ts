/**
 * Evolution Sprint 8 — strategy scoring helpers.
 */

import {
  clamp01,
  clampScore,
  emptyScores,
  type StrategyScores,
  type TravelStrategyContext,
} from './strategyTypes'

export function scoreOverallValue(scores: Omit<StrategyScores, 'overallValue' | 'confidence'>): number {
  return clampScore(
    scores.budget * 0.14
      + scores.comfort * 0.12
      + scores.time * 0.1
      + scores.convenience * 0.12
      + scores.experience * 0.14
      + scores.weather * 0.1
      + scores.crowds * 0.08
      + scores.transportation * 0.1
      + scores.flexibility * 0.1,
  )
}

export function withOverall(scores: Partial<StrategyScores> & {
  budget: number
  comfort: number
  time: number
  convenience: number
  experience: number
  weather: number
  crowds: number
  transportation: number
  flexibility: number
  confidence: number
}): StrategyScores {
  const base = emptyScores(scores)
  return {
    ...base,
    overallValue: scoreOverallValue(base),
    confidence: clamp01(scores.confidence),
  }
}

export function contextConfidence(ctx: TravelStrategyContext): number {
  let c = 0.35
  if (ctx.destinationLabel) c += 0.1
  if (typeof ctx.monthHint === 'number') c += 0.1
  if (typeof ctx.budgetAmount === 'number') c += 0.12
  if (typeof ctx.durationDays === 'number') c += 0.1
  if (ctx.purpose) c += 0.08
  if (ctx.destinationPriors) c += 0.1
  if ((ctx.missingInformation?.length ?? 0) >= 4) c -= 0.15
  return clamp01(c)
}

export function blendScores(
  a: StrategyScores,
  b: StrategyScores,
  weightA = 0.5,
): StrategyScores {
  const wB = 1 - weightA
  const mixed = {
    budget: a.budget * weightA + b.budget * wB,
    comfort: a.comfort * weightA + b.comfort * wB,
    time: a.time * weightA + b.time * wB,
    convenience: a.convenience * weightA + b.convenience * wB,
    experience: a.experience * weightA + b.experience * wB,
    weather: a.weather * weightA + b.weather * wB,
    crowds: a.crowds * weightA + b.crowds * wB,
    transportation: a.transportation * weightA + b.transportation * wB,
    flexibility: a.flexibility * weightA + b.flexibility * wB,
    confidence: a.confidence * weightA + b.confidence * wB,
  }
  return withOverall(mixed)
}

export const StrategyScoring = {
  overall: scoreOverallValue,
  withOverall,
  contextConfidence,
  blend: blendScores,
}
