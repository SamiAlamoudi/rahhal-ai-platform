/**
 * Phase 4 — Conversation Intelligence models (rule-based, no LLM APIs).
 */

export type ConsultantLocale = 'ar' | 'en'

export type TripPurposeKind =
  | 'business'
  | 'leisure'
  | 'family'
  | 'honeymoon'
  | 'adventure'
  | 'luxury'
  | null

export type ConversationIntentKind =
  | 'search_flights'
  | 'search_hotels'
  | 'complete_trip'
  | 'visa_question'
  | 'weather'
  | 'budget_advice'
  | 'modify_trip'
  | 'cancel_booking'
  | 'travel_inspiration'
  | 'packing'
  | 'travel_rules'
  | 'airport_info'
  | 'local_transport'
  | 'restaurants'
  | 'emergency'
  | 'currency'
  | 'unknown'

export interface TravelerBreakdown {
  adults: number | null
  children: number | null
  infants: number | null
  total: number | null
}

export interface LiveTravelMemory {
  destination: string | null
  cities: string[]
  budgetAmount: number | null
  currency: string | null
  startDate: string | null
  endDate: string | null
  monthHint: string | null
  flexibleDates: boolean | null
  travelers: TravelerBreakdown
  purpose: TripPurposeKind
  hotelPreferences: string[]
  flightPreferences: string[]
  airlines: string[]
  seatPreference: string | null
  stopoverPreference: 'direct' | 'flexible' | null
  activities: string[]
  visaStatus: string | null
  passportNationality: string | null
  weatherPreference: string | null
  languagePreference: ConsultantLocale | null
  specialRequests: string[]
  updatedAt: string
}

export interface ExtractedEntities {
  destination: string | null
  cities: string[]
  budgetAmount: number | null
  currency: string | null
  monthHint: string | null
  startDate: string | null
  endDate: string | null
  flexibleDates: boolean | null
  adults: number | null
  children: number | null
  infants: number | null
  purpose: TripPurposeKind
  hotelPreferences: string[]
  flightPreferences: string[]
  airlines: string[]
  seatPreference: string | null
  stopoverPreference: 'direct' | 'flexible' | null
  activities: string[]
  visaStatus: string | null
  passportNationality: string | null
  weatherPreference: string | null
  specialRequests: string[]
  /** Raw cues used for debugging / tests */
  cues: string[]
}

export interface ResolvedReference {
  phrase: string
  resolvesTo: string
  kind: 'destination' | 'hotel' | 'budget' | 'date' | 'airline' | 'person' | 'other'
}

export interface IntelligentQuestion {
  id: string
  priority: number
  textAr: string
  textEn: string
  /** Outcome-changing rationale */
  whyAr: string
  whyEn: string
}

export interface ProactiveInsight {
  id: string
  textAr: string
  textEn: string
}

export interface ConversationSummary {
  bulletsAr: string[]
  bulletsEn: string[]
  confirmPromptAr: string
  confirmPromptEn: string
}

export interface ConversationIntelligenceResult {
  enabled: true
  locale: ConsultantLocale
  intent: ConversationIntentKind
  intentConfidence: number
  entities: ExtractedEntities
  memory: LiveTravelMemory
  references: ResolvedReference[]
  summary: ConversationSummary
  questions: IntelligentQuestion[]
  insights: ProactiveInsight[]
  /** Consultant-facing short notes for Conversation Brain soft facts */
  consultantNotes: string[]
  /** Partial-utterance friendly: true when analysis ran on incomplete speech */
  streaming: boolean
}

export interface ConversationIntelligenceAnalyzeInput {
  userText: string
  priorMemory?: LiveTravelMemory | null
  locale?: ConsultantLocale
  /** Prior assistant/user lines for reference resolution */
  recentTexts?: string[]
  streaming?: boolean
}
