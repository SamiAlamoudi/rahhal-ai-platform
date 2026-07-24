/**
 * Phase 3 Stage 3 — Proactive Travel Advisor contracts.
 * Recommendations only. Never mutates planning / itinerary / pricing.
 */

export type ProactiveLocale = 'ar' | 'en'

export type ProactiveSignalKind =
  | 'visa_reminder'
  | 'passport_expiry_reminder'
  | 'season_advice'
  | 'weather_notice'
  | 'airport_recommendation'
  | 'hotel_checkin_reminder'
  | 'transportation_reminder'
  | 'packing_suggestion'
  | 'currency_reminder'
  | 'esim_suggestion'
  | 'timezone_warning'
  | 'travel_insurance_reminder'
  | 'meeting_logistics'
  | 'executive_travel'
  | 'family_travel'
  | 'accessibility'
  | 'budget_optimization'
  | 'alternative_timing'

export type ProactiveEvidenceSource =
  | 'user_text'
  | 'memory'
  | 'traveler'
  | 'destination'
  | 'strategy'
  | 'unified_response'

export interface ProactiveEvidence {
  kind: string
  detail: string
  source: ProactiveEvidenceSource
}

/**
 * Voice Center preparation — speakable hint only.
 * Do not implement voice playback here.
 */
export interface ProactiveVoiceHint {
  speakableSummary: string
  locale: ProactiveLocale
  urgency: 'low' | 'medium' | 'high'
}

/**
 * Knowledge Center preparation — opaque entry references only.
 * Do not resolve or fetch knowledge here.
 */
export interface ProactiveKnowledgeRef {
  /** Future Knowledge Center entry id (opaque). */
  entryId: string
  topic: string
  optional: true
}

/**
 * Memory Center preparation — append-only preference hints.
 * Never overwrite prior memories.
 */
export interface ProactiveMemoryAppend {
  key: string
  value: string
  /** Always append; consumers must not overwrite. */
  mode: 'append'
}

export interface ProactiveRecommendation {
  id: string
  signal: ProactiveSignalKind
  title: string
  message: string
  reason: string
  confidence: number
  supportingEvidence: ProactiveEvidence[]
  missingEvidence: string[]
  clarificationRequired: boolean
  priority: number
  voiceHint: ProactiveVoiceHint | null
  knowledgeRefs: ProactiveKnowledgeRef[]
  memoryAppend: ProactiveMemoryAppend[]
}

export interface ProactiveContextBag {
  locale: ProactiveLocale
  conversationId: string
  userText: string
  destination: string | null
  origin: string | null
  budgetAmount: number | null
  budgetCurrency: string | null
  durationDays: number | null
  adults: number | null
  children: number | null
  monthHint: number | null
  tripPurpose: string | null
  interests: string[]
  travelerNotes: string[]
  destinationNotes: string[]
  strategyNotes: string[]
  unifiedSummary: string[]
  hasFamilySignal: boolean
  hasBusinessSignal: boolean
  hasAccessibilitySignal: boolean
  hasDatesSignal: boolean
  hasBudgetSignal: boolean
  hasDestinationSignal: boolean
}

export interface ProactiveDetectedSignal {
  signal: ProactiveSignalKind
  reason: string
  supportingEvidence: ProactiveEvidence[]
  missingEvidence: string[]
  baseConfidence: number
}

export interface ProactiveAdvisorInput {
  locale?: ProactiveLocale
  conversationId: string
  userText: string
  /** Opaque bags from prior layers — read-only. */
  memoryContext?: unknown
  travelerUnderstanding?: unknown
  destinationUnderstanding?: unknown
  strategySummary?: unknown
  unifiedResponse?: unknown
  multiTurnSnapshot?: unknown
  enabled?: boolean
  now?: Date
  maxRecommendations?: number
}

export interface ProactiveAdvisorResult {
  enabled: true
  conversationId: string
  recommendations: ProactiveRecommendation[]
  signalsDetected: ProactiveSignalKind[]
  durationMs: number
}

/** Snapshot attached to AgentProviderMeta.proactiveAdvisor */
export interface ProactiveAdvisorMetaSnapshot {
  enabled: true
  conversationId: string
  recommendationCount: number
  recommendations: ProactiveRecommendation[]
  signalsDetected: ProactiveSignalKind[]
  durationMs: number
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function isoNow(now?: Date): string {
  return (now ?? new Date()).toISOString()
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}
