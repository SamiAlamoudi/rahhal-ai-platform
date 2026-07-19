/**
 * Sprint 28 — Conversation Memory & Context Engine types.
 * Short-term conversation memory + long-term travel preferences + assembled context.
 * No LLM providers; rule-based extraction and privacy-safe storage only.
 */

import type {
  BrainLocale,
  BrainMemorySlot,
  CabinClass,
  ConversationHistory,
  ConversationMemory,
  TravelIntent,
  TripPreferences,
} from '../types'

/** Extended preference slots introduced in Sprint 28 (additive to BrainMemorySlot). */
export type ExtendedMemorySlot =
  | BrainMemorySlot
  | 'familyMembers'
  | 'passportNationality'
  | 'seatPreferences'
  | 'mealPreferences'
  | 'accessibilityRequirements'
  | 'loyaltyPrograms'

export type SeatPreference = 'window' | 'aisle' | 'middle' | 'exit_row' | 'any'

export type MealPreference =
  | 'halal'
  | 'vegetarian'
  | 'vegan'
  | 'kosher'
  | 'gluten_free'
  | 'diabetic'
  | 'other'

export type VisaStatus =
  | 'valid'
  | 'needs_visa'
  | 'visa_free'
  | 'on_arrival'
  | 'unknown'
  | 'needs_check'

export interface FamilyMember {
  /** Display label or given name when provided. */
  label: string
  relation: 'spouse' | 'partner' | 'child' | 'infant' | 'parent' | 'sibling' | 'other' | null
  age: number | null
}

/**
 * Passport / nationality — stored only when the user explicitly discloses it.
 * Never inferred from accent, language, or destination.
 */
export interface PassportNationalitySlot {
  nationality: string | null
  passportCountry: string | null
  explicitlyProvided: boolean
}

export interface LoyaltyProgramEntry {
  program: string
  /** Membership number — sensitive; omitted from summaries / logs. */
  memberNumber: string | null
}

/** Sprint 28 additive fields on session ConversationMemory (optional for back-compat). */
export interface ConversationMemoryExtensions {
  familyMembers: FamilyMember[]
  passportNationality: PassportNationalitySlot
  seatPreferences: SeatPreference[]
  mealPreferences: MealPreference[]
  accessibilityRequirements: string[]
  loyaltyPrograms: LoyaltyProgramEntry[]
  /** Normalized visa status when extractable. */
  visaStatus: VisaStatus | null
}

export type EnrichedConversationMemory = ConversationMemory & ConversationMemoryExtensions

/** Long-term travel preference profile (user-scoped, privacy-gated). */
export interface TravelPreferenceProfile {
  userId: string
  version: 1
  preferredAirlines: string[]
  preferredHotelBrands: string[]
  cabinClass: CabinClass | null
  budgetRange: {
    min: number | null
    max: number | null
    currency: string | null
  }
  typicalTravelerCount: number | null
  familyMembers: FamilyMember[]
  /**
   * Nationality only — passport numbers are never stored long-term.
   * Present only when explicitly provided and privacy allows.
   */
  nationality: string | null
  visaStatus: VisaStatus | null
  seatPreferences: SeatPreference[]
  mealPreferences: MealPreference[]
  accessibilityRequirements: string[]
  /** Program names only long-term — no membership numbers. */
  loyaltyPrograms: string[]
  tripStyle: TripPreferences | null
  /** ISO timestamps for retention. */
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  /** Privacy: whether sensitive fields may be retained. */
  allowSensitiveRetention: boolean
}

/** Short-term conversation session state. */
export interface ShortTermMemoryState {
  conversationId: string
  userId: string | null
  memory: EnrichedConversationMemory
  history: ConversationHistory
  summary: ConversationSummary | null
  followUpQuestions: string[]
  missingSlots: ExtendedMemorySlot[]
  createdAt: string
  updatedAt: string
  /** Absolute expiry for short-term session. */
  expiresAt: string
  turnCount: number
}

export interface ConversationSummary {
  conversationId: string
  locale: BrainLocale
  /** Compact narrative of the conversation so far (no raw PII). */
  text: string
  /** Key facts retained after summarization. */
  keyFacts: string[]
  /** Turn ids covered by this summary. */
  coveredTurnIds: string[]
  turnCount: number
  createdAt: string
}

/** Assembled context for the orchestrator / planners. */
export interface AssembledContext {
  conversationId: string
  userId: string | null
  locale: BrainLocale
  /** Current turn text. */
  currentMessage: string
  /** Short-term session memory (enriched). */
  shortTerm: ShortTermMemoryState
  /** Previous conversation state snapshot (before this turn's write). */
  previousState: ShortTermMemoryState | null
  /** Long-term prefs (null when privacy blocks or no user). */
  longTerm: TravelPreferenceProfile | null
  /** Merged working memory for planners (session overrides long-term). */
  workingMemory: EnrichedConversationMemory
  summary: ConversationSummary | null
  /** Recent turns kept after windowing (not full history when summarized). */
  recentTurns: ConversationHistory['turns']
  missingSlots: ExtendedMemorySlot[]
  followUpQuestions: string[]
  lastIntent: TravelIntent | null
  assembledAt: string
}

export interface MemoryExtractionResult {
  sessionPatch: Partial<EnrichedConversationMemory>
  longTermPatch: Partial<TravelPreferenceProfile>
  entities: Record<string, unknown>
  /** True when passport/nationality was explicitly stated. */
  explicitSensitiveDisclosure: boolean
}

export interface MemoryEngineTurnResult {
  context: AssembledContext
  extraction: MemoryExtractionResult
  shortTerm: ShortTermMemoryState
  longTerm: TravelPreferenceProfile | null
  summary: ConversationSummary | null
  summarized: boolean
  expired: boolean
  followUpQuestions: string[]
  missingSlots: ExtendedMemorySlot[]
}

export type MemoryExpirationPolicy = {
  /** Short-term session TTL (ms). Default 24h. */
  shortTermTtlMs: number
  /** Long-term preference TTL (ms). Default 180d. null = no expiry. */
  longTermTtlMs: number | null
  /** Sensitive fields (passport/nationality) TTL in short-term (ms). Default 2h. */
  sensitiveTtlMs: number
  /** Summarize after this many turns. Default 12. */
  summarizeAfterTurns: number
  /** Keep this many recent turns after summarization. Default 6. */
  recentTurnWindow: number
}

export const DEFAULT_MEMORY_EXPIRATION_POLICY: MemoryExpirationPolicy = {
  shortTermTtlMs: 24 * 60 * 60 * 1000,
  longTermTtlMs: 180 * 24 * 60 * 60 * 1000,
  sensitiveTtlMs: 2 * 60 * 60 * 1000,
  summarizeAfterTurns: 12,
  recentTurnWindow: 6,
}
