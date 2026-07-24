/**
 * Evolution Sprint 7 — Destination comparison logic.
 */

import { findDestinationKnowledge } from './destinationKnowledge'
import { matchTravelerScore } from './destinationSummary'
import type {
  DestinationComparisonResult,
  DestinationKnowledgeRecord,
  TravelerMatchInput,
} from './destinationTypes'

function dimDelta(
  left: DestinationKnowledgeRecord,
  right: DestinationKnowledgeRecord,
  key: keyof DestinationKnowledgeRecord,
  label: string,
): string | null {
  const lv = left[key]
  const rv = right[key]
  if (typeof lv !== 'number' || typeof rv !== 'number') return null
  const d = lv - rv
  if (Math.abs(d) < 8) return null
  return d > 0
    ? `${left.nameEn} leads on ${label} (${lv} vs ${rv}).`
    : `${right.nameEn} leads on ${label} (${rv} vs ${lv}).`
}

export function compareDestinations(
  leftQuery: string,
  rightQuery: string,
  traveler?: TravelerMatchInput,
  monthHint?: number | null,
): DestinationComparisonResult | null {
  const left = findDestinationKnowledge(leftQuery)
  const right = findDestinationKnowledge(rightQuery)
  if (!left || !right) return null

  const reasons: string[] = []
  for (const [key, label] of [
    ['foodScore', 'food'],
    ['luxuryScore', 'luxury'],
    ['adventureScore', 'adventure'],
    ['familySuitability', 'family'],
    ['natureScore', 'nature'],
    ['cityScore', 'city'],
    ['shoppingScore', 'shopping'],
    ['transportationQuality', 'transport'],
    ['nightlifeScore', 'nightlife'],
    ['photographyScore', 'photography'],
  ] as Array<[keyof DestinationKnowledgeRecord, string]>) {
    const line = dimDelta(left, right, key, label)
    if (line) reasons.push(line)
  }

  reasons.push(
    `Cost band: ${left.nameEn}=${left.costExpectations} vs ${right.nameEn}=${right.costExpectations}.`,
  )
  reasons.push(
    `Visa complexity: ${left.nameEn}=${left.visaComplexity} vs ${right.nameEn}=${right.visaComplexity}.`,
  )

  const leftMatch = matchTravelerScore(left, traveler, monthHint)
  const rightMatch = matchTravelerScore(right, traveler, monthHint)

  let winnerId: string | null = null
  if (traveler) {
    if (Math.abs(leftMatch.score - rightMatch.score) < 5) winnerId = null
    else winnerId = leftMatch.score >= rightMatch.score ? left.id : right.id
    reasons.push(
      `Traveler match scores: ${left.nameEn}=${leftMatch.score}, ${right.nameEn}=${rightMatch.score}.`,
    )
  } else {
    const leftOverall =
      (left.foodScore + left.cityScore + left.familySuitability + left.transportationQuality) / 4
    const rightOverall =
      (right.foodScore + right.cityScore + right.familySuitability + right.transportationQuality) / 4
    if (Math.abs(leftOverall - rightOverall) < 5) winnerId = null
    else winnerId = leftOverall >= rightOverall ? left.id : right.id
  }

  const tradeoffs = [
    ...left.knownWeaknesses.slice(0, 2).map((w) => `${left.nameEn}: ${w}`),
    ...right.knownWeaknesses.slice(0, 2).map((w) => `${right.nameEn}: ${w}`),
  ]

  return {
    leftId: left.id,
    rightId: right.id,
    winnerId,
    reasons: reasons.slice(0, 10),
    leftStrengths: [...left.topStrengths],
    rightStrengths: [...right.topStrengths],
    tradeoffs,
    travelerMatch: traveler
      ? {
          leftScore: leftMatch.score,
          rightScore: rightMatch.score,
          preferredId:
            Math.abs(leftMatch.score - rightMatch.score) < 5
              ? null
              : leftMatch.score >= rightMatch.score
                ? left.id
                : right.id,
        }
      : undefined,
  }
}

export const DestinationComparator = {
  compare: compareDestinations,
}
