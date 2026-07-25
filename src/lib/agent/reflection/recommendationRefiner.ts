/**
 * Evolution Sprint 2 — RecommendationRefiner
 * Builds RecommendationRecord snapshots from cached/refreshed nodes.
 * Does not rebuild unaffected nodes (caller passes refreshed set).
 */

import type { RecommendationReasonerResult } from '../reasoning/consultantTypes'
import {
  isoNow,
  newId,
  uniqueStrings,
  type AssumptionRecord,
  type CachedReasoningNodes,
  type ReasoningNodeId,
  type RecommendationRecord,
} from './reflectionTypes'

export function buildRecommendationRecord(options: {
  nodes: CachedReasoningNodes
  assumptions: AssumptionRecord[]
  evidence: string[]
  refreshedNodes: ReasoningNodeId[]
  reasonForChange: string
  now?: Date
}): RecommendationRecord | null {
  const rec = options.nodes.recommendation
  if (!rec) return null

  const constraints = uniqueStrings([
    ...(options.nodes.constraints?.constraints.hard ?? []),
    ...(options.nodes.constraints?.constraints.soft ?? []),
  ])

  const missingData = uniqueStrings([
    ...rec.missingInformation,
    ...(options.nodes.intent?.missingInformation ?? []),
    ...(options.nodes.profile?.missingInformation ?? []),
    ...(options.nodes.destination?.missingInformation ?? []),
    ...(options.nodes.budget?.missingInformation ?? []),
  ])

  const assumptionTexts = options.assumptions
    .filter((a) => a.status === 'active')
    .map((a) => a.text)

  return {
    id: newId('rec', options.now),
    confidence: rec.confidence,
    timestamp: isoNow(options.now),
    evidence: uniqueStrings(options.evidence),
    constraints,
    tradeoffs: uniqueStrings(rec.recommendation.tradeoffs),
    assumptions: uniqueStrings(assumptionTexts.length ? assumptionTexts : rec.assumptions),
    missingData,
    reasonForChange: options.reasonForChange,
    primaryAction: rec.recommendation.primaryAction,
    why: [...rec.recommendation.why],
    whyNot: [...rec.recommendation.whyNot],
    alternative: [...rec.recommendation.alternative],
    risk: [...rec.recommendation.risk],
    expectedValue: [...rec.recommendation.expectedValue],
    recommendationScore: rec.recommendationScore,
    refreshedNodes: [...options.refreshedNodes],
  }
}

export function refineReasonForChange(options: {
  isColdStart: boolean
  changedSlots: string[]
  refreshedNodes: ReasoningNodeId[]
  previous: RecommendationRecord | null
  current: RecommendationReasonerResult | null
}): string {
  if (options.isColdStart || !options.previous) {
    return 'Initial consultant recommendation from first reflection pass.'
  }
  if (options.changedSlots.length) {
    return `Updated after new traveler information on: ${options.changedSlots.join(', ')}. Refreshed nodes: ${options.refreshedNodes.join(', ')}.`
  }
  if (options.previous.primaryAction !== options.current?.recommendation.primaryAction) {
    return `Primary action shifted from ${options.previous.primaryAction} to ${options.current?.recommendation.primaryAction}.`
  }
  return `Refined recommendation using refreshed nodes: ${options.refreshedNodes.join(', ') || 'none'}.`
}

export const RecommendationRefiner = {
  buildRecommendationRecord,
  refineReasonForChange,
}
