/**
 * Bilamo Arabic Language Intelligence — contracts.
 * Dialect-specific wording never reaches the Intelligence Layer.
 */

export const BILAMO_ARABIC_INTELLIGENCE_VERSION = '1.0.0-multidialect'

/** Supported traveler dialects (input understanding). Extensible via catalog. */
export type BilamoArabicDialectId =
  | 'msa'
  | 'saudi'
  | 'gulf'
  | 'emirati'
  | 'kuwaiti'
  | 'qatari'
  | 'bahraini'
  | 'omani'
  | 'yemeni'
  | 'egyptian'
  | 'levantine'
  | 'iraqi'
  | 'moroccan'
  | 'algerian'
  | 'tunisian'
  | 'sudanese'

export type BilamoDialectDetectionSource = 'detected' | 'default_msa' | 'latin'

export interface BilamoDialectDetection {
  dialect: BilamoArabicDialectId
  /** 0–1 soft confidence. */
  confidence: number
  source: BilamoDialectDetectionSource
}

export interface BilamoArabicNormalizeResult {
  version: typeof BILAMO_ARABIC_INTELLIGENCE_VERSION
  /** Original traveler text (unchanged for display). */
  originalText: string
  /**
   * Canonical Arabic/English for extractors & Intelligence Layer.
   * Dialect-specific wording is rewritten here only.
   */
  normalizedText: string
  detection: BilamoDialectDetection
  /** Which rewrite families fired (telemetry / tests). */
  applied: {
    textPrep: boolean
    intent: boolean
    travelers: boolean
    dates: boolean
    places: boolean
  }
  /** Semantic hints derived during normalization (optional boosters). */
  hints: {
    travelIntent: boolean
    travelers: number | null
    travelerType: 'solo' | 'couple' | 'family' | 'friends' | null
    children: number | null
    infants: number | null
    relativeDateHint: string | null
  }
}

export type DialectRewriteRule = {
  /** Unique id for tests / future tooling. */
  id: string
  /** Match dialectal / variant phrasing. */
  pattern: RegExp
  /** Canonical replacement understood by product extractors. */
  replace: string | ((match: string, ...groups: string[]) => string)
}

export type BilamoDialectDefinition = {
  id: BilamoArabicDialectId
  labelAr: string
  labelEn: string
  group: 'msa' | 'peninsula' | 'gulf' | 'egypt' | 'levant' | 'iraq' | 'yemen' | 'maghreb' | 'sudan'
  /** Soft detection cues — never force caricature. */
  cues: Array<{ weight: number; pattern: RegExp }>
}
