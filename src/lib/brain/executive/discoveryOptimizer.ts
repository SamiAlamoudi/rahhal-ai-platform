/**
 * Phase 2 — Discovery Optimizer.
 * Re-ranks destinations by scenery, activities, or total cost.
 */

import { findDestinationProfile } from '../../agent/reasoning/destinationCatalog'
import type { DestinationCandidate, TravelReasoningResult } from '../../agent/reasoning/types'
import type { AgentLocale } from '../../agent/types'
import type { ExecutiveContext, OptimizationAxis } from './types'

const SCENERY_TAGS = new Set(['nature', 'beach', 'romance'])
const ACTIVITY_TAGS = new Set(['culture', 'adventure', 'food', 'shopping', 'city'])

export function detectOptimizationAxis(
  text: string,
  locale: AgentLocale,
): OptimizationAxis | null {
  const lower = text.toLowerCase()

  if (
    /\b(?:scenery|views|landscape|nature|lakes|mountains)\b/i.test(lower)
    || /(?:مناظر|طبيعة|بحيرات|جبال)/.test(text)
    || /\boptimize for scenery\b/i.test(lower)
  ) {
    return 'scenery'
  }

  if (
    /\b(?:activities|things to do|experiences|culture)\b/i.test(lower)
    || /(?:أنشطة|فعاليات|ثقافة)/.test(text)
    || /\boptimize for activities\b/i.test(lower)
  ) {
    return 'activities'
  }

  if (
    /\b(?:cost|budget|cheaper|total cost|price)\b/i.test(lower)
    || /(?:تكلفة|ميزانية|أرخص|ارخص)/.test(text)
    || /\boptimize for (?:cost|budget)\b/i.test(lower)
  ) {
    return 'cost'
  }

  if (locale === 'ar' && /(?:المناظر|الأنشطة|التكلفة)/.test(text)) {
    if (text.includes('المناظر')) return 'scenery'
    if (text.includes('الأنشطة')) return 'activities'
    if (text.includes('التكلفة')) return 'cost'
  }

  return null
}

export function optimizeDiscoveryRanking(
  result: TravelReasoningResult,
  context: ExecutiveContext,
): TravelReasoningResult {
  const axis = context.optimizationAxis
  if (!axis || axis === 'balanced') return result

  const rows = [result.primary, ...result.alternatives].filter(
    (row): row is DestinationCandidate => Boolean(row),
  )
  if (rows.length <= 1) return result

  const scored = rows.map((row) => ({
    row,
    boost: axisBoost(row, axis, context),
  }))

  scored.sort((a, b) => (b.row.score + b.boost) - (a.row.score + a.boost))

  const primary = scored[0]?.row ?? null
  const alternatives = scored.slice(1, 4).map((entry) => entry.row)

  const rationale = [...result.rationale]
  const axisNote = axisRationale(axis, context.locale)
  if (!rationale.includes(axisNote)) {
    rationale.unshift(axisNote)
  }

  return {
    ...result,
    primary,
    alternatives,
    rationale: rationale.slice(0, 5),
  }
}

function axisBoost(
  candidate: DestinationCandidate,
  axis: OptimizationAxis,
  context: ExecutiveContext,
): number {
  const profile = findDestinationProfile(candidate.id)
  const tags = new Set(profile?.bestFor ?? [])

  if (axis === 'scenery') {
    let boost = 0
    for (const tag of tags) {
      if (SCENERY_TAGS.has(tag)) boost += 0.08
    }
    if (candidate.climateMatch === 'cold' || candidate.climateMatch === 'cool') boost += 0.04
    return boost
  }

  if (axis === 'activities') {
    let boost = 0
    for (const tag of tags) {
      if (ACTIVITY_TAGS.has(tag)) boost += 0.06
    }
    if (context.familyTravel && tags.has('family')) boost += 0.05
    return boost
  }

  if (axis === 'cost') {
    if (candidate.budgetFit === 'under') return 0.15
    if (candidate.budgetFit === 'fit') return 0.1
    if (candidate.budgetFit === 'tight') return 0.02
    if (candidate.budgetFit === 'over') return -0.2
  }

  return 0
}

function axisRationale(axis: OptimizationAxis, locale: AgentLocale): string {
  if (locale === 'ar') {
    if (axis === 'scenery') return 'رتّبت الوجهات لصالح المناظر والطبيعة'
    if (axis === 'activities') return 'رتّبت الوجهات لصالح الأنشطة والتجارب'
    return 'رتّبت الوجهات لصالح أقل تكلفة إجمالية'
  }
  if (axis === 'scenery') return 'Re-ranked for scenery and natural landscapes'
  if (axis === 'activities') return 'Re-ranked for activities and experiences'
  return 'Re-ranked for lowest total trip cost'
}
