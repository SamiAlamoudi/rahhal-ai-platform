/**
 * Evolution Sprint 5 — Traveler Intelligence Layer contracts.
 *
 * Evolving behavioral model (NOT a static user profile).
 * Additive only. Does not modify Reasoning, Reflection, PlanningGraph,
 * Decision Engine, Planning Draft, Conversation Brain, Smart Clarification,
 * Production Authority, or planTurn. CPU-only — no network / LLM.
 */

export type TravelerLocale = 'ar' | 'en'

/** Preference dimensions inferred from conversation behavior. */
export type PreferenceKey =
  | 'travel_style'
  | 'budget_flexibility'
  | 'luxury_preference'
  | 'adventure_preference'
  | 'nature_vs_cities'
  | 'transit_tolerance'
  | 'walking_tolerance'
  | 'climate_preference'
  | 'food_exploration'
  | 'shopping_interest'
  | 'family_friendliness'
  | 'photography_interest'
  | 'nightlife_preference'
  | 'activity_density'
  | 'decision_confidence'
  | 'risk_tolerance'
  | 'comfort_preference'
  | 'pace'
  | 'season_preference'
  | 'destination_affinity'

export type PreferencePolarity = 'low' | 'medium' | 'high' | 'unknown' | string

/**
 * Every preference observation / stored value carries these fields.
 */
export interface PreferenceEvidenceItem {
  id: string
  text: string
  timestamp: string
  conversationSource: string
  reasoningRef: string | null
  reflectionRef: string | null
  weight: number
}

export interface PreferenceSignal {
  key: PreferenceKey
  /** Canonical label / polarity / categorical value. */
  value: PreferencePolarity
  /** Numeric lean when applicable (−1 … +1 or 0…1 depending on key). */
  lean: number
  confidence: number
  evidence: PreferenceEvidenceItem[]
  timestamp: string
  conversationSource: string
  reasoningRef: string | null
  reflectionRef: string | null
}

export interface StoredPreference {
  key: PreferenceKey
  value: PreferencePolarity
  lean: number
  confidence: number
  evidence: PreferenceEvidenceItem[]
  updatedAt: string
  /** Prior contradictory values retained for audit. */
  contradictions: Array<{
    value: PreferencePolarity
    lean: number
    confidence: number
    timestamp: string
    evidenceIds: string[]
  }>
}

export interface TravelerProfileSnapshot {
  locale: TravelerLocale
  displayHints: string[]
  purposeHints: string[]
  partyHints: string[]
  updatedAt: string
}

export interface TravelDna {
  primaryStyle: string
  secondaryStyles: string[]
  budgetGene: string
  paceGene: string
  riskGene: string
  placeGene: string
  foodGene: string
  activityGene: string
  climateGene: string
  signature: string[]
}

export interface TravelerPersonality {
  traits: string[]
  summary: string
  locale: TravelerLocale
}

export interface PlanningBias {
  preferFlexibleDates: boolean
  preferValueOverCheapest: boolean
  preferLowFriction: boolean
  preferComfort: boolean
  clarifyAggressiveness: 'low' | 'medium' | 'high'
  notes: string[]
}

export interface RecommendationBias {
  favorDestinations: string[]
  avoidThemes: string[]
  weightLuxury: number
  weightAdventure: number
  weightFamily: number
  weightFood: number
  weightNightlife: number
  weightNature: number
  notes: string[]
}

export interface TravelerSnapshot {
  modelId: string
  locale: TravelerLocale
  timestamp: string
  preferences: StoredPreference[]
  personality: TravelerPersonality
  travelDna: TravelDna
  planningBias: PlanningBias
  recommendationBias: RecommendationBias
  overallConfidence: number
  summary: string
}

export interface TravelerModelState {
  id: string
  locale: TravelerLocale
  createdAt: string
  updatedAt: string
  profile: TravelerProfileSnapshot
  preferences: Partial<Record<PreferenceKey, StoredPreference>>
  evidenceLog: PreferenceEvidenceItem[]
  turnCount: number
  confidenceHistory: Array<{ timestamp: string; overall: number; reason: string }>
  lastSources: {
    reasoningRef: string | null
    reflectionRef: string | null
    conversationSource: string | null
  }
}

export interface TravelerObserveInput {
  userText: string
  locale?: TravelerLocale
  conversationSource?: string
  reasoningRef?: string | null
  reflectionRef?: string | null
  now?: Date
  enabled?: boolean
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

export function newId(prefix: string, now?: Date): string {
  const t = (now ?? new Date()).getTime().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}_${r}`
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function clampLean(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(-1, Math.min(1, n))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export const ALL_PREFERENCE_KEYS: PreferenceKey[] = [
  'travel_style',
  'budget_flexibility',
  'luxury_preference',
  'adventure_preference',
  'nature_vs_cities',
  'transit_tolerance',
  'walking_tolerance',
  'climate_preference',
  'food_exploration',
  'shopping_interest',
  'family_friendliness',
  'photography_interest',
  'nightlife_preference',
  'activity_density',
  'decision_confidence',
  'risk_tolerance',
  'comfort_preference',
  'pace',
  'season_preference',
  'destination_affinity',
]
