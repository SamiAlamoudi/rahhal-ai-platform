/**
 * Evolution Sprint 2 — AlternativeExplorer
 * Surfaces alternative directions as conversation evolves (no inventory APIs).
 */

import type { DestinationReasonerResult } from '../reasoning/consultantTypes'
import { uniqueStrings, type KnownSlots, type RecommendationRecord } from './reflectionTypes'

const PURPOSE_ALTS: Record<string, string[]> = {
  honeymoon: ['Maldives', 'Santorini', 'Bali'],
  family: ['Istanbul', 'Dubai', 'Kuala Lumpur'],
  business: ['Dubai', 'London', 'Riyadh'],
  adventure: ['Georgia', 'Nepal', 'Jordan'],
  recovery: ['Maldives', 'Bodrum', 'Baku'],
  cultural: ['Istanbul', 'Cairo', 'Rome'],
  leisure: ['Istanbul', 'Baku', 'Batumi'],
}

export function exploreAlternatives(options: {
  slots: KnownSlots
  destination: DestinationReasonerResult | null
  recommendation: RecommendationRecord | null
  priorAlternatives: string[]
}): string[] {
  const fromDest = options.destination?.destinationFit.alternativesToConsider ?? []
  const fromRec = options.recommendation?.alternative ?? []
  const purpose = options.slots.tripPurpose ?? 'leisure'
  const catalog = PURPOSE_ALTS[purpose] ?? PURPOSE_ALTS.leisure ?? []
  const locked = options.slots.destination

  const merged = uniqueStrings([
    ...options.priorAlternatives,
    ...fromDest,
    ...catalog,
    ...fromRec
      .map((line) => {
        const m = line.match(/Alternative(?: direction)?: ([^.]+)/i)
        return m?.[1]?.split(/\s+or\s+|،|,/)[0]?.trim() ?? ''
      })
      .filter(Boolean),
  ])

  // Keep locked destination out of alternatives list.
  return merged.filter((name) => !locked || name.toLowerCase() !== locked.toLowerCase()).slice(0, 6)
}

export const AlternativeExplorer = {
  exploreAlternatives,
}
