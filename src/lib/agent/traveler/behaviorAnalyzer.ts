/**
 * Evolution Sprint 5 — BehaviorAnalyzer (orchestrates domain analyzers).
 */

import type { PreferenceSignal } from './travelerTypes'
import type { AnalyzerContext } from './analyzerContext'
import { analyzeRiskTolerance } from './riskToleranceAnalyzer'
import { analyzeBudgetBehavior } from './budgetBehaviorAnalyzer'
import { analyzeComfort } from './comfortAnalyzer'
import { analyzeTravelStyle } from './travelStyleAnalyzer'
import { analyzeFoodPreference } from './foodPreferenceAnalyzer'
import { analyzeActivityPreference } from './activityPreferenceAnalyzer'
import { analyzePace } from './paceAnalyzer'
import { analyzeSeasonPreference } from './seasonPreferenceAnalyzer'
import { analyzeDestinationAffinity } from './destinationAffinity'
import { analyzeWalkingAndTransit } from './mobilityAnalyzers'
import { analyzeSocialAndMedia } from './socialAnalyzers'
import { analyzeDecisionConfidence } from './decisionConfidenceAnalyzer'

export function analyzeBehavior(ctx: AnalyzerContext): PreferenceSignal[] {
  return [
    ...analyzeTravelStyle(ctx),
    ...analyzeBudgetBehavior(ctx),
    ...analyzeRiskTolerance(ctx),
    ...analyzeComfort(ctx),
    ...analyzePace(ctx),
    ...analyzeFoodPreference(ctx),
    ...analyzeActivityPreference(ctx),
    ...analyzeSeasonPreference(ctx),
    ...analyzeDestinationAffinity(ctx),
    ...analyzeWalkingAndTransit(ctx),
    ...analyzeSocialAndMedia(ctx),
    ...analyzeDecisionConfidence(ctx),
  ]
}

export const BehaviorAnalyzer = {
  analyze: analyzeBehavior,
}
