/**
 * Evolution Sprint 1 — ReasoningPipeline
 *
 * Runs consultant reasoners in order and returns a full bundle.
 * Additive / offline — does NOT hook into planTurn, Decision Engine,
 * Planning Draft, Conversation Brain, or Smart Clarification.
 */

import { analyzeTravelerIntent } from './travelerIntentAnalyzer'
import { buildTravelerProfile } from './travelerProfileBuilder'
import { analyzeConstraints } from './constraintAnalyzer'
import { reasonAboutDestination } from './destinationReasoner'
import { reasonAboutBudget } from './budgetReasoner'
import { reasonAboutRisk } from './riskReasoner'
import { reasonAboutValue } from './valueReasoner'
import { reasonAboutRecommendation } from './recommendationReasoner'
import { generateExplanation } from './explanationGenerator'
import { isConsultantReasoningEnabled } from './consultantFeature'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type ConsultantReasoningPipelineResult,
  type ReasoningSlice,
} from './consultantTypes'

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

function rollupOverall(
  slices: ReasoningSlice[],
): ReasoningSlice {
  const n = slices.length || 1
  const confidence = clamp01(slices.reduce((s, x) => s + x.confidence, 0) / n)
  const recommendationScore = clampScore(
    slices.reduce((s, x) => s + x.recommendationScore, 0) / n,
  )
  return emptySlice({
    confidence,
    reasoning: [
      'Pipeline rollup across intent, profile, constraints, destination, budget, risk, value, recommendation, explanation.',
      `Average confidence=${confidence.toFixed(2)}; average score=${recommendationScore}.`,
    ],
    tradeoffs: unique(slices.flatMap((x) => x.tradeoffs)).slice(0, 8),
    assumptions: unique(slices.flatMap((x) => x.assumptions)).slice(0, 8),
    missingInformation: unique(slices.flatMap((x) => x.missingInformation)).slice(0, 10),
    recommendationScore,
  })
}

/**
 * Full consultant reasoning pass. Safe to call anytime; production wiring is gated
 * by `ai.consultant_reasoning` (default OFF) and is intentionally not attached to planTurn.
 */
export function runConsultantReasoningPipeline(
  input: ConsultantReasoningInput,
  options?: { enabled?: boolean },
): ConsultantReasoningPipelineResult {
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const normalized: ConsultantReasoningInput = { ...input, locale }

  // Even when the flag is off, unit/pipeline tests may force `enabled: true`.
  // Callers that respect the product gate should check `isConsultantReasoningEnabled` first.
  void isConsultantReasoningEnabled
  void options

  const intent = analyzeTravelerIntent(normalized)
  const profile = buildTravelerProfile(normalized)
  const constraints = analyzeConstraints(normalized)
  const destination = reasonAboutDestination(normalized)
  const budget = reasonAboutBudget(normalized)
  const risk = reasonAboutRisk(normalized)
  const value = reasonAboutValue(normalized)
  const recommendation = reasonAboutRecommendation(normalized)
  const explanation = generateExplanation(normalized, recommendation)

  const overall = rollupOverall([
    intent,
    profile,
    constraints,
    destination,
    budget,
    risk,
    value,
    recommendation,
    explanation,
  ])

  return {
    locale,
    intent,
    profile,
    constraints,
    destination,
    budget,
    risk,
    value,
    recommendation,
    explanation,
    overall,
  }
}

/**
 * Gate-aware entry: returns null when the feature flag is off (unless forced).
 * Does not touch planTurn.
 */
export function tryRunConsultantReasoningPipeline(
  input: ConsultantReasoningInput,
  options?: { enabled?: boolean },
): ConsultantReasoningPipelineResult | null {
  if (!isConsultantReasoningEnabled(options)) return null
  return runConsultantReasoningPipeline(input, options)
}

export const ReasoningPipeline = {
  run: runConsultantReasoningPipeline,
  tryRun: tryRunConsultantReasoningPipeline,
}
