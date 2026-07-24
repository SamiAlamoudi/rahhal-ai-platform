/**
 * Evolution Sprint 6 — RecommendationSummary
 */

import type { RecommendationPackage, RecommendationFormats } from './recommendationTypes'
import { buildFormats } from './recommendationNarrative'

export function summarizeRecommendation(pkg: RecommendationPackage): {
  action: string
  label: string
  confidencePct: number
  missingCount: number
  alternativeCount: number
  formats: RecommendationFormats
} {
  return {
    action: pkg.action,
    label: pkg.primaryRecommendation.label,
    confidencePct: Math.round(pkg.confidence * 100),
    missingCount: pkg.missingInformation.length,
    alternativeCount: pkg.alternatives.length,
    formats: buildFormats(pkg),
  }
}

export const RecommendationSummary = {
  summarize: summarizeRecommendation,
}
