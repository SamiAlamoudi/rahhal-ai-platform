/**
 * Evolution Sprint 7 — Destination Intelligence engine entrypoints.
 * Not wired into planTurn. CPU-only · offline.
 */

import { isDestinationIntelligenceEnabled } from './destinationFeature'
import { findDestinationKnowledge, listDestinationKnowledge } from './destinationKnowledge'
import { resolveDestinationProfile } from './destinationProfile'
import { buildDestinationSnapshot } from './destinationSummary'
import { compareDestinations } from './destinationComparator'
import type {
  DestinationComparisonResult,
  DestinationEngineInput,
  DestinationSnapshot,
} from './destinationTypes'

export interface DestinationEngineResult {
  snapshot: DestinationSnapshot | null
  comparison: DestinationComparisonResult | null
  unresolved: string[]
}

export function runDestinationIntelligence(
  input: DestinationEngineInput,
): DestinationEngineResult {
  const locale = input.locale ?? 'ar'
  const unresolved: string[] = []
  const record = findDestinationKnowledge(input.destinationQuery)
  if (!record) unresolved.push(input.destinationQuery)

  const snapshot = record
    ? buildDestinationSnapshot({
        record,
        locale,
        traveler: input.traveler,
        monthHint: input.monthHint ?? input.traveler?.monthHint,
        now: input.now,
      })
    : null

  let comparison: DestinationComparisonResult | null = null
  if (input.compareWith) {
    comparison = compareDestinations(
      input.destinationQuery,
      input.compareWith,
      input.traveler,
      input.monthHint ?? input.traveler?.monthHint,
    )
    if (!comparison) {
      if (!findDestinationKnowledge(input.compareWith)) unresolved.push(input.compareWith)
    }
  }

  return { snapshot, comparison, unresolved }
}

export function tryRunDestinationIntelligence(
  input: DestinationEngineInput,
): DestinationEngineResult | null {
  if (!isDestinationIntelligenceEnabled({ enabled: input.enabled })) return null
  return runDestinationIntelligence(input)
}

export const DestinationIntelligence = {
  run: runDestinationIntelligence,
  tryRun: tryRunDestinationIntelligence,
  find: findDestinationKnowledge,
  list: listDestinationKnowledge,
  resolve: resolveDestinationProfile,
  compare: compareDestinations,
  snapshot: buildDestinationSnapshot,
}
