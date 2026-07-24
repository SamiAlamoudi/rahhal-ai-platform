/**
 * Phase 3 Stage 4 — Travel Intelligence Layer contracts.
 * Evaluation / ranking / explanation only. Never mutates planning.
 */

export type IntelligenceLocale = 'ar' | 'en'

/** Dimensions used when comparing travel alternatives. */
export type IntelligenceDimension =
  | 'price'
  | 'duration'
  | 'convenience'
  | 'visa_difficulty'
  | 'weather_suitability'
  | 'family_friendliness'
  | 'business_suitability'
  | 'accessibility'
  | 'preference_fit'
  | 'conversation_fit'

export interface IntelligenceEvidence {
  kind: string
  detail: string
  source:
    | 'user_text'
    | 'memory'
    | 'preferences'
    | 'alternative'
    | 'comparison'
    | 'conversation'
}

/**
 * Voice Center preparation — speakable summary only.
 * No speech / playback / TTS.
 */
export interface TravelVoiceSummary {
  speakableSummary: string
  locale: IntelligenceLocale
  tone: 'neutral' | 'consultative'
}

/**
 * Knowledge Center preparation — opaque references only.
 * Never load books / articles here.
 */
export interface KnowledgeReference {
  entryId: string
  topic: string
  optional: true
}

/**
 * Memory Center preparation — append-only preference hints.
 * Never overwrite prior memories.
 */
export interface IntelligenceMemoryAppend {
  key: string
  value: string
  mode: 'append'
}

export interface TravelAlternative {
  id: string
  label: string
  destination: string
  /** Opaque cost signal 0–1 (higher = more expensive). Never real pricing. */
  priceSignal: number
  /** Trip length days when known; null if unknown. */
  durationDays: number | null
  convenience: number
  visaDifficulty: number
  weatherSuitability: number
  familyFriendliness: number
  businessSuitability: number
  accessibility: number
  preferenceFit: number
  conversationFit: number
  notes: string[]
}

export interface DimensionScore {
  dimension: IntelligenceDimension
  score: number
  evidence: IntelligenceEvidence[]
}

export interface AlternativeComparison {
  alternativeId: string
  dimensions: DimensionScore[]
  overallScore: number
}

export interface TradeoffInsight {
  id: string
  between: [string, string]
  dimension: IntelligenceDimension
  summary: string
  winnerId: string | null
  confidence: number
}

export interface IntelligenceRankedRecommendation {
  rank: number
  alternativeId: string
  label: string
  destination: string
  score: number
  confidence: number
  justification: string
  tradeoffs: string[]
}

export interface IntelligenceContext {
  locale: IntelligenceLocale
  conversationId: string
  userText: string
  destination: string | null
  budgetAmount: number | null
  durationDays: number | null
  adults: number | null
  children: number | null
  tripPurpose: string | null
  interests: string[]
  hasFamilySignal: boolean
  hasBusinessSignal: boolean
  hasAccessibilitySignal: boolean
  monthHint: number | null
  conversationNotes: string[]
}

export interface TravelIntelligenceInput {
  locale?: IntelligenceLocale
  conversationId: string
  userText: string
  /** Read-only bags from prior layers. */
  memoryContext?: unknown
  travelerPreferences?: unknown
  conversationContext?: unknown
  candidateDestinations?: string[]
  enabled?: boolean
  now?: Date
  maxAlternatives?: number
}

export interface TravelIntelligenceResult {
  enabled: true
  conversationId: string
  alternatives: TravelAlternative[]
  comparisons: AlternativeComparison[]
  tradeoffs: TradeoffInsight[]
  ranked: IntelligenceRankedRecommendation[]
  primaryId: string | null
  overallConfidence: number
  explanation: string
  voiceSummary: TravelVoiceSummary | null
  knowledgeRefs: KnowledgeReference[]
  memoryAppend: IntelligenceMemoryAppend[]
  durationMs: number
}

/** Snapshot for AgentProviderMeta.travelIntelligence */
export interface TravelIntelligenceMetaSnapshot {
  enabled: true
  conversationId: string
  alternativeCount: number
  rankedCount: number
  primaryId: string | null
  overallConfidence: number
  explanation: string
  ranked: IntelligenceRankedRecommendation[]
  tradeoffs: TradeoffInsight[]
  voiceSummary: TravelVoiceSummary | null
  knowledgeRefs: KnowledgeReference[]
  memoryAppend: IntelligenceMemoryAppend[]
  durationMs: number
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}
