/**
 * Sprint 87 — Compatibility adapter over Destination Knowledge.
 * Prefer `destinationKnowledge` for new code. City recommendations are derived
 * from structured scores — not hardcoded essays.
 */

import {
  buildDestinationReasoningLines,
  getDestinationKnowledgeByKey,
  indicativeBudgetForSlots,
  inferTripStyle,
  readTaggedDuration,
  reasonFromDestinationKnowledge,
  resolveKnowledgeKey,
  type DestinationReasoning,
  type TripStyleHint,
} from './destinationKnowledge'
import type { TravelPlanSlots } from './planning/types'

/** @deprecated Use DestinationReasoning from destinationKnowledge. */
export type DestinationInsight = {
  destinationKey: string
  displayNameAr: string
  displayNameEn: string
  cities: string[]
  citiesEn: string[]
  seasonNoteAr: string
  seasonNoteEn: string
  typicalDurationDays: { min: number; max: number; recommended: number }
  indicativeBudgetSar: { low: number; mid: number; high: number }
  weatherNoteAr: string
  weatherNoteEn: string
  flightNoteAr: string
  flightNoteEn: string
  timezoneNoteAr: string
  timezoneNoteEn: string
  attractionsAr: string[]
  attractionsEn: string[]
  itinerarySketchAr: string[]
  itinerarySketchEn: string[]
  cityContrastAr?: string
  cityContrastEn?: string
  styleNotesAr: Partial<Record<TripStyleHint, string>>
  styleNotesEn: Partial<Record<TripStyleHint, string>>
}

export type { TripStyleHint }

export function resolveDestinationCatalogKey(destination?: string | null): string | null {
  return resolveKnowledgeKey(destination, null)
}

export function resolveInsightKey(
  destination?: string | null,
  specialRequests?: string | null,
): string | null {
  return resolveKnowledgeKey(destination, specialRequests)
}

function toLegacyInsight(reasoning: DestinationReasoning): DestinationInsight {
  const k = reasoning.knowledge
  return {
    destinationKey: k.key,
    displayNameAr: k.displayNameAr,
    displayNameEn: k.displayNameEn,
    cities: reasoning.recommendedCityNamesAr,
    citiesEn: reasoning.recommendedCityNamesEn,
    seasonNoteAr: reasoning.seasonAr,
    seasonNoteEn: reasoning.seasonEn,
    typicalDurationDays: reasoning.duration,
    indicativeBudgetSar: reasoning.budgetSar,
    weatherNoteAr: reasoning.climateAr,
    weatherNoteEn: reasoning.climateEn,
    flightNoteAr: reasoning.flightAr,
    flightNoteEn: reasoning.flightEn,
    timezoneNoteAr: reasoning.timezoneAr,
    timezoneNoteEn: reasoning.timezoneEn,
    attractionsAr: reasoning.attractionsAr,
    attractionsEn: reasoning.attractionsEn,
    itinerarySketchAr: reasoning.itinerarySketchAr,
    itinerarySketchEn: reasoning.itinerarySketchEn,
    cityContrastAr: reasoning.cityContrastAr,
    cityContrastEn: reasoning.cityContrastEn,
    styleNotesAr: { [reasoning.tripStyle]: reasoning.styleNoteAr },
    styleNotesEn: { [reasoning.tripStyle]: reasoning.styleNoteEn },
  }
}

export function getDestinationInsight(
  destination?: string | null,
  specialRequests?: string | null,
): DestinationInsight | null {
  const reasoning = reasonFromDestinationKnowledge({ destination, specialRequests })
  return reasoning ? toLegacyInsight(reasoning) : null
}

export {
  inferTripStyle,
  readTaggedDuration,
  buildDestinationReasoningLines,
  indicativeBudgetForSlots,
  reasonFromDestinationKnowledge,
  getDestinationKnowledgeByKey,
}

export function reasoningForSlots(slots: TravelPlanSlots): DestinationReasoning | null {
  return reasonFromDestinationKnowledge({
    destination: slots.destination,
    specialRequests: slots.specialRequests,
    adults: slots.adults,
    children: slots.children,
  })
}
