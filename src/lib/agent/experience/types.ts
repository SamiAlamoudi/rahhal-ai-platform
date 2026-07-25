/**
 * Phase 3 Stage 5 — Experience Intelligence Layer contracts.
 * UI-ready presentation models only. Never mutates planning.
 */

export type ExperienceLocale = 'ar' | 'en'

export type ExperienceCardKind =
  | 'executive_summary'
  | 'trip_highlight'
  | 'timeline'
  | 'recommended_action'
  | 'alert'
  | 'weather_placeholder'
  | 'visa_placeholder'
  | 'transportation_placeholder'
  | 'hotel_placeholder'
  | 'flight_placeholder'
  | 'budget_placeholder'
  | 'alternative'
  | 'quick_fact'
  | 'missing_info'
  | 'next_question'

export interface ExperienceCard {
  id: string
  kind: ExperienceCardKind
  title: string
  body: string
  priority: number
  /** Optional icon key for future UI (not rendered here). */
  iconKey: string | null
  tags: string[]
}

export interface ExperienceTimelineItem {
  id: string
  day: number | null
  label: string
  detail: string
  order: number
}

export interface ExperienceSection {
  id: string
  title: string
  cards: ExperienceCard[]
}

export interface ExperienceTripSummaryModel {
  headline: string
  destination: string | null
  durationDays: number | null
  budgetLabel: string | null
  travelerLabel: string | null
  purpose: string | null
  confidence: number
  missingInformation: string[]
  nextQuestions: string[]
}

export interface ExperienceModel {
  executiveSummary: ExperienceCard | null
  tripHighlights: ExperienceCard[]
  destinationHighlights: ExperienceCard[]
  timeline: ExperienceTimelineItem[]
  recommendedActions: ExperienceCard[]
  importantAlerts: ExperienceCard[]
  placeholders: {
    weather: ExperienceCard
    visa: ExperienceCard
    transportation: ExperienceCard
    hotel: ExperienceCard
    flight: ExperienceCard
    budget: ExperienceCard
  }
  recommendedAlternatives: ExperienceCard[]
  quickFacts: ExperienceCard[]
  sections: ExperienceSection[]
  summary: ExperienceTripSummaryModel
  confidence: number
  missingInformation: string[]
  nextQuestions: string[]
}

/* -------------------------------------------------------------------------- */
/* Voice Center preparation (interfaces only — no speech / TTS)               */
/* -------------------------------------------------------------------------- */

export interface ExperienceVoiceSession {
  sessionId: string
  locale: ExperienceLocale
  status: 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended'
}

export interface ExperienceVoiceReply {
  text: string
  speakable: string
  locale: ExperienceLocale
}

export interface ExperienceVoiceTranscript {
  text: string
  isFinal: boolean
  at: string
}

export interface ExperienceVoiceAction {
  actionId: string
  label: string
  kind: 'confirm' | 'clarify' | 'navigate' | 'repeat'
}

export interface ExperienceVoiceContext {
  conversationId: string
  lastUserText: string | null
  lastAssistantText: string | null
  activeGoal: string | null
}

/* -------------------------------------------------------------------------- */
/* Knowledge Center preparation (interfaces only — no retrieval)              */
/* -------------------------------------------------------------------------- */

export interface ExperienceKnowledgeBook {
  bookId: string
  title: string
  topic: string
}

export interface ExperienceTravelGuide {
  guideId: string
  destination: string
  title: string
}

export interface ExperienceVisaGuide {
  guideId: string
  destination: string
  title: string
}

export interface ExperiencePdfLibraryItem {
  documentId: string
  title: string
  kind: 'pdf' | 'doc'
}

export interface ExperienceSavedArticle {
  articleId: string
  title: string
  urlHint: string | null
}

export interface ExperienceFavorite {
  favoriteId: string
  refType: 'book' | 'guide' | 'article' | 'destination'
  refId: string
}

/** Opaque Knowledge Center surface for future wiring. */
export interface ExperienceKnowledgeSurface {
  books: ExperienceKnowledgeBook[]
  travelGuides: ExperienceTravelGuide[]
  visaGuides: ExperienceVisaGuide[]
  pdfLibrary: ExperiencePdfLibraryItem[]
  savedArticles: ExperienceSavedArticle[]
  favorites: ExperienceFavorite[]
}

/* -------------------------------------------------------------------------- */
/* Future module placeholders (architecture only)                             */
/* -------------------------------------------------------------------------- */

export type ExperienceFutureModuleId =
  | 'voice_experience'
  | 'knowledge_center'
  | 'books'
  | 'documents'
  | 'pdf_assistant'
  | 'trip_dashboard'
  | 'live_flight_tracking'
  | 'hotel_tracking'
  | 'notifications'
  | 'maps'
  | 'offline_mode'

export interface ExperienceFutureModulePlaceholder {
  moduleId: ExperienceFutureModuleId
  status: 'placeholder'
  description: string
}

export interface ExperienceComposerInput {
  locale?: ExperienceLocale
  conversationId: string
  userText: string
  /** Read-only bags from prior layers. */
  memoryContext?: unknown
  tripPlan?: unknown
  consultantResponse?: unknown
  proactiveAdvisor?: unknown
  travelIntelligence?: unknown
  multiTurnSnapshot?: unknown
  enabled?: boolean
  now?: Date
}

export interface ExperienceComposerResult {
  enabled: true
  conversationId: string
  experience: ExperienceModel
  voice: {
    session: ExperienceVoiceSession | null
    context: ExperienceVoiceContext
    /** Interfaces ready; no playback. */
    prepared: true
  }
  knowledge: ExperienceKnowledgeSurface
  futureModules: ExperienceFutureModulePlaceholder[]
  durationMs: number
}

/** Snapshot for AgentProviderMeta.experience */
export interface ExperienceMetaSnapshot {
  enabled: true
  conversationId: string
  experience: ExperienceModel
  voicePrepared: true
  knowledgePrepared: true
  futureModuleIds: ExperienceFutureModuleId[]
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
