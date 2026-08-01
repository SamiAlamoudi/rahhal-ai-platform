/**
 * Sprint 87 — Destination Knowledge layer (data-driven).
 * Add a new country/city by inserting a DestinationKnowledge record only.
 * Brain reasons from these fields — never from hardcoded reply strings.
 */

/** 0–10 suitability / intensity scores. */
export type KnowledgeScore = number

export type TripStyleHint = 'leisure' | 'business' | 'family' | 'weekend' | 'solo' | 'honeymoon'

export type LocalizedText = {
  ar: string
  en: string
}

export type BudgetBandSar = {
  low: number
  mid: number
  high: number
}

export type DurationBand = {
  min: number
  max: number
  recommended: number
}

export type AirportInfo = {
  code: string
  nameEn: string
  nameAr: string
  cityKey?: string
  primary?: boolean
}

export type CityKnowledge = {
  key: string
  nameEn: string
  nameAr: string
  aliases?: string[]
  /** Short character labels used by the reasoner (not user-facing essays). */
  traitsEn: string[]
  traitsAr: string[]
  familyScore: KnowledgeScore
  honeymoonScore: KnowledgeScore
  businessScore: KnowledgeScore
  beaches: KnowledgeScore
  mountains: KnowledgeScore
  nightlife: KnowledgeScore
  shopping: KnowledgeScore
  culture: KnowledgeScore
  /** Suggested stay days when this city is in the itinerary. */
  suggestedDays: number
  highlightsEn?: string[]
  highlightsAr?: string[]
}

/**
 * One destination knowledge record (country or focused city destination).
 * Future destinations = insert another record + aliases; no planner code changes.
 */
export type DestinationKnowledge = {
  key: string
  kind: 'country' | 'city'
  country: string
  countryAr: string
  displayNameEn: string
  displayNameAr: string
  aliases: string[]
  /** Parent country key when kind=city (e.g. agadir → morocco). */
  parentKey?: string
  cities: CityKnowledge[]
  bestSeason: LocalizedText
  climate: LocalizedText
  averageBudgetSar: BudgetBandSar
  tripDuration: DurationBand
  familyScore: KnowledgeScore
  honeymoonScore: KnowledgeScore
  businessScore: KnowledgeScore
  beaches: KnowledgeScore
  mountains: KnowledgeScore
  nightlife: KnowledgeScore
  shopping: KnowledgeScore
  culture: KnowledgeScore
  transportation: LocalizedText
  visaNotes: LocalizedText
  airports: AirportInfo[]
  /** Flight duration / routing notes from KSA (indicative). */
  flightFromKsa: LocalizedText
  timezone: LocalizedText
  attractionsEn: string[]
  attractionsAr: string[]
}

/** Derived view produced by the knowledge reasoner (not stored data). */
export type RankedCity = {
  city: CityKnowledge
  score: number
  reasonsEn: string[]
  reasonsAr: string[]
}

export type DestinationReasoning = {
  knowledge: DestinationKnowledge
  tripStyle: TripStyleHint
  rankedCities: RankedCity[]
  cityContrastEn: string
  cityContrastAr: string
  recommendedCityNamesEn: string[]
  recommendedCityNamesAr: string[]
  itinerarySketchEn: string[]
  itinerarySketchAr: string[]
  styleNoteEn: string
  styleNoteAr: string
  seasonEn: string
  seasonAr: string
  climateEn: string
  climateAr: string
  duration: DurationBand
  budgetSar: BudgetBandSar
  adjustedBudgetMid: number
  flightEn: string
  flightAr: string
  timezoneEn: string
  timezoneAr: string
  visaEn: string
  visaAr: string
  transportEn: string
  transportAr: string
  airportSummaryEn: string
  airportSummaryAr: string
  attractionsEn: string[]
  attractionsAr: string[]
  scores: {
    family: KnowledgeScore
    honeymoon: KnowledgeScore
    business: KnowledgeScore
    beaches: KnowledgeScore
    mountains: KnowledgeScore
    nightlife: KnowledgeScore
    shopping: KnowledgeScore
    culture: KnowledgeScore
  }
}
