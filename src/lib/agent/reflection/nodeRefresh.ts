/**
 * Evolution Sprint 2 — selective node refresh.
 * Calls Sprint 1 reasoners only for dirty nodes; reuses cached results otherwise.
 * Does not modify Sprint 1 modules.
 */

import { analyzeTravelerIntent } from '../reasoning/travelerIntentAnalyzer'
import { buildTravelerProfile } from '../reasoning/travelerProfileBuilder'
import { analyzeConstraints } from '../reasoning/constraintAnalyzer'
import { reasonAboutDestination } from '../reasoning/destinationReasoner'
import { reasonAboutBudget } from '../reasoning/budgetReasoner'
import { reasonAboutRisk } from '../reasoning/riskReasoner'
import { reasonAboutValue } from '../reasoning/valueReasoner'
import { reasonAboutRecommendation } from '../reasoning/recommendationReasoner'
import { generateExplanation } from '../reasoning/explanationGenerator'
import { clamp01, clampScore, emptySlice } from '../reasoning/consultantTypes'
import type { ConsultantReasoningInput, ConsultantReasoningPipelineResult } from '../reasoning/consultantTypes'
import type { CachedReasoningNodes, ReasoningNodeId } from './reflectionTypes'
import { uniqueStrings } from './reflectionTypes'

export function refreshDirtyNodes(
  input: ConsultantReasoningInput,
  prior: CachedReasoningNodes,
  dirty: ReasoningNodeId[],
): CachedReasoningNodes {
  const next: CachedReasoningNodes = { ...prior }
  const needs = (id: ReasoningNodeId) => dirty.includes(id) || prior[id] == null

  // Order matters for Sprint 1 purity (each analyzer may re-derive upstream).
  if (needs('intent')) next.intent = analyzeTravelerIntent(input)
  if (needs('profile')) next.profile = buildTravelerProfile(input)
  if (needs('constraints')) next.constraints = analyzeConstraints(input)
  if (needs('destination')) next.destination = reasonAboutDestination(input)
  if (needs('budget')) next.budget = reasonAboutBudget(input)
  if (needs('risk')) next.risk = reasonAboutRisk(input)
  if (needs('value')) next.value = reasonAboutValue(input)
  if (needs('recommendation')) next.recommendation = reasonAboutRecommendation(input)
  if (needs('explanation')) {
    next.explanation = generateExplanation(
      input,
      next.recommendation ?? undefined,
    )
  }
  return next
}

export function nodesToBundle(
  locale: 'ar' | 'en',
  nodes: CachedReasoningNodes,
): ConsultantReasoningPipelineResult | null {
  if (
    !nodes.intent
    || !nodes.profile
    || !nodes.constraints
    || !nodes.destination
    || !nodes.budget
    || !nodes.risk
    || !nodes.value
    || !nodes.recommendation
    || !nodes.explanation
  ) {
    return null
  }

  const slices = [
    nodes.intent,
    nodes.profile,
    nodes.constraints,
    nodes.destination,
    nodes.budget,
    nodes.risk,
    nodes.value,
    nodes.recommendation,
    nodes.explanation,
  ]
  const confidence = clamp01(slices.reduce((s, x) => s + x.confidence, 0) / slices.length)
  const recommendationScore = clampScore(
    slices.reduce((s, x) => s + x.recommendationScore, 0) / slices.length,
  )

  return {
    locale,
    intent: nodes.intent,
    profile: nodes.profile,
    constraints: nodes.constraints,
    destination: nodes.destination,
    budget: nodes.budget,
    risk: nodes.risk,
    value: nodes.value,
    recommendation: nodes.recommendation,
    explanation: nodes.explanation,
    overall: emptySlice({
      confidence,
      reasoning: ['Reflection rollup from cached + refreshed nodes.'],
      tradeoffs: uniqueStrings(slices.flatMap((x) => x.tradeoffs)).slice(0, 8),
      assumptions: uniqueStrings(slices.flatMap((x) => x.assumptions)).slice(0, 8),
      missingInformation: uniqueStrings(slices.flatMap((x) => x.missingInformation)).slice(0, 10),
      recommendationScore,
    }),
  }
}
