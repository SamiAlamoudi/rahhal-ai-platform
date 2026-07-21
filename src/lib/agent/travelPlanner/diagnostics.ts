/**
 * Sprint 78 — Travel Planner diagnostics.
 */

import type { TravelPlannerDiagnostics, TravelPlannerResult } from './types'

export function buildPlannerDiagnostics(result: Omit<TravelPlannerResult, 'diagnostics' | 'recommendationFacts' | 'durationMs' | 'version'>): TravelPlannerDiagnostics {
  return {
    travelStrategy: result.travelStrategy.summary,
    constraints: result.constraints,
    priorityWeights: result.priorityWeights,
    plannerReasoning: result.travelStrategy.rationale,
    confidenceScore: result.confidenceScore,
    questionsAsked: result.combinedQuestion ? [result.combinedQuestion] : [],
    searchPlan: result.searchPlan,
  }
}
