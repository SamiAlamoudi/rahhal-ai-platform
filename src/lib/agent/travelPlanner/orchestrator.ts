/**
 * Sprint 78 — AI Travel Strategy Planner orchestrator.
 */

import type { AgentMemory } from '../types'
import { computePlannerConfidence } from './confidence'
import { detectConstraints } from './constraints'
import { buildPlannerDiagnostics } from './diagnostics'
import { buildPriorityWeights } from './priority'
import { resolveTravelPurpose } from './purpose'
import { detectMissingInformation, planRequiredQuestions } from './questionPlanner'
import { buildSearchStrategy } from './strategy'
import type { TravelPlannerResult } from './types'
import { SPRINT78_TRAVEL_PLANNER_VERSION } from './types'

export interface RunTravelPlannerInput {
  userText?: string | null
  memory?: AgentMemory | null
  locale?: 'ar' | 'en'
}

export function runTravelPlanner(input: RunTravelPlannerInput): TravelPlannerResult {
  const started = Date.now()
  const locale = input.locale
    ?? input.memory?.locale
    ?? (/[\u0600-\u06FF]/.test(input.userText ?? '') ? 'ar' : 'en')

  const purposeSignals = resolveTravelPurpose(input.userText, input.memory)
  const { constraints, preferences, riskFlags } = detectConstraints(input.userText, input.memory)

  // Soft-fill destination/origin from text aliases already in memory when present
  const missingInformation = detectMissingInformation({
    memory: input.memory,
    constraints,
    userText: input.userText,
  })
  const { requiredQuestions, combinedQuestion } = planRequiredQuestions({
    missingInformation,
    locale,
  })

  const { decisions, searchPlan, strategy } = buildSearchStrategy({
    purpose: purposeSignals.travelPurpose,
    tripType: purposeSignals.tripType,
    constraints,
    riskFlags,
    memory: input.memory,
    missingInformation,
  })

  const priorityWeights = buildPriorityWeights(purposeSignals.travelPurpose, constraints)
  const confidenceScore = computePlannerConfidence({
    purpose: purposeSignals.travelPurpose,
    constraints,
    missingInformation,
    cueCount: purposeSignals.cues.length,
  })

  const base = {
    travelPurpose: purposeSignals.travelPurpose,
    tripType: purposeSignals.tripType,
    travelerType: purposeSignals.travelerType,
    constraints,
    preferences,
    missingInformation,
    requiredQuestions,
    combinedQuestion: decisions.shouldAskQuestion ? combinedQuestion : null,
    recommendedSearchOrder: searchPlan.recommendedSearchOrder,
    priorityWeights,
    riskFlags,
    travelStrategy: strategy,
    confidenceScore,
    decisions,
    searchPlan,
  }

  const diagnostics = buildPlannerDiagnostics(base)
  // When we intentionally defer questions (search path), keep questionsAsked empty
  if (!decisions.shouldAskQuestion) {
    diagnostics.questionsAsked = []
  }

  const recommendationFacts: string[] = [
    `Travel strategy: ${strategy.summary}`,
    `Purpose: ${purposeSignals.travelPurpose} · confidence ${confidenceScore}`,
  ]
  if (searchPlan.hotelFirst) recommendationFacts.push('Search plan: hotels before flights')
  else recommendationFacts.push('Search plan: flights before hotels')
  if (combinedQuestion && decisions.shouldAskQuestion) {
    recommendationFacts.push(`Planner question: ${combinedQuestion}`)
  }
  if (riskFlags.length) recommendationFacts.push(`Risk flags: ${riskFlags.slice(0, 3).join(', ')}`)

  return {
    version: SPRINT78_TRAVEL_PLANNER_VERSION,
    ...base,
    combinedQuestion: decisions.shouldAskQuestion ? combinedQuestion : null,
    diagnostics,
    recommendationFacts,
    durationMs: Date.now() - started,
  }
}
