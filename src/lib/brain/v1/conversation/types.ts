/**
 * Sprint 85 — Conversation Manager contracts (Value Before Questions).
 * Brain v1 island. Gated by `ai.brain.v1`. No UI / Voice / providers / booking.
 */

import type { ExplainableRecommendation } from '../destinationKnowledge/types'
import type { BrainV1Intent, BrainV1PreferenceMemory } from '../types'
import type {
  TravelPlan,
  TravelPlanSlotKey,
  TravelPlanSlots,
  TravelGoal,
} from '../planning/types'

export const CONVERSATION_MANAGER_VERSION = '1.2.0-live-brain-experience'

export type ConversationLifecycleState =
  | 'idle'
  | 'greeting'
  | 'collecting'
  | 'waiting_user'
  | 'revising'
  | 'paused'
  | 'resumed'
  | 'topic_switch'
  | 'summarizing'
  | 'ready'
  | 'completed'
  | 'restarted'
  | 'value_first'

export type ClarificationTier = 'blocking' | 'high_impact' | 'optional'

export type ConversationStage =
  | 'explore'
  | 'search'
  | 'booking'
  | 'payment'

export interface ConversationAssumption {
  field: string
  assumedValue: string | number | boolean
  reason: string
  confidence: number
  reversible: boolean
  /** Must be confirmed before booking/payment. */
  requiresConfirmationBeforeBooking: boolean
  source: 'assumption_engine' | 'memory_soft_default'
}

export interface ConversationQuestion {
  slot: TravelPlanSlotKey | string
  tier: ClarificationTier
  priority: number
  questionAr: string
  questionEn: string
  whyAr: string
  whyEn: string
}

export interface ConversationValueItem {
  id: string
  kind: 'destination_option' | 'itinerary_direction' | 'estimate' | 'criteria' | 'tip' | 'shortlist'
  titleAr: string
  titleEn: string
  detailAr: string
  detailEn: string
  /** Never live inventory — always preliminary. */
  preliminary: true
}

export interface ConversationResponse {
  ar: string
  en: string
  tone: 'friendly' | 'clarify' | 'summary' | 'revise' | 'resume' | 'pause' | 'value_first'
  /** True when the reply includes useful travel value before any question. */
  providedValue: boolean
  questionCount: number
}

/** Internal structured decision (not shown raw to the user). */
export interface ConversationDecisionModel {
  goalUnderstanding: string
  value: ConversationValueItem[]
  assumptions: ConversationAssumption[]
  question: ConversationQuestion | null
  questionReason: string | null
  confidence: number
  requiresConfirmationBeforeAction: boolean
  nextBestAction: string
}

export interface ConversationSummary {
  currentGoal: string
  knownInformation: Array<{ slot: TravelPlanSlotKey | 'intent'; value: string }>
  remainingQuestions: Array<TravelPlanSlotKey | string>
  currentRecommendations: string[]
  textAr: string
  textEn: string
}

export type ConfidenceBand = 'high' | 'medium' | 'low_safe' | 'low_unsafe'

export interface ConversationConfidence {
  intent: number
  entities: number
  slots: number
  recommendations: number
  overall: number
  band: ConfidenceBand
  lowConfidence: boolean
  /** May ask at most one question — never auto-forces a questionnaire. */
  mayAskClarification: boolean
  forceBlockingQuestion: boolean
}

export interface ConversationExplanation {
  whyQuestionAr: string | null
  whyQuestionEn: string | null
  whyRecommendationAr: string | null
  whyRecommendationEn: string | null
  missingAr: string
  missingEn: string
}

export interface ConversationTurnRecord {
  role: 'user' | 'assistant'
  text: string
  at: string
}

export interface ConversationSession {
  sessionId: string
  state: ConversationLifecycleState
  plan: TravelPlan | null
  goal: TravelGoal | null
  completedSlots: TravelPlanSlotKey[]
  pendingSlots: Array<TravelPlanSlotKey | string>
  answeredSlots: TravelPlanSlotKey[]
  assumptions: ConversationAssumption[]
  turns: ConversationTurnRecord[]
  pausedGoalLabel: string | null
  previousGoalLabel: string | null
  topicStack: string[]
  locale: 'ar' | 'en'
  stage: ConversationStage
  createdAt: string
  updatedAt: string
  restartedCount: number
}

export interface ConversationManagerInput {
  text: string
  locale?: 'ar' | 'en'
  priorSession?: ConversationSession | null
  pause?: boolean
  resume?: boolean
  restart?: boolean
  /** Conversation stage affects blocking vs exploratory behavior. */
  stage?: ConversationStage
  /** Injectable recommendation blurbs (no providers / no live prices). */
  recommendations?: string[]
  preferenceMemory?: Partial<BrainV1PreferenceMemory>
  /**
   * Structured missing fields from tools (ConversationManager decides whether to ask).
   * Tools must not generate multi-question questionnaires.
   */
  toolMissingFields?: Array<{ field: string; tier: ClarificationTier; reason: string }>
  /** Hard blocking fields for booking/payment stages. */
  blockingFields?: Array<{ field: string; reason: string; questionAr: string; questionEn: string }>
  maxQuestionsPerTurn?: number
}

export interface ConversationManagerResult {
  version: string
  enabled: boolean
  session: ConversationSession | null
  response: ConversationResponse | null
  question: ConversationQuestion | null
  summary: ConversationSummary | null
  confidence: ConversationConfidence | null
  explanation: ConversationExplanation | null
  decision: ConversationDecisionModel | null
  assumptions: ConversationAssumption[]
  value: ConversationValueItem[]
  revisedSlots: TravelPlanSlotKey[]
  knownSlots: TravelPlanSlots | null
  intent: BrainV1Intent | null
  /**
   * Sprint 87 — structured destination explainability for future UI.
   * Not rendered in chat copy by default.
   */
  destinationExplainability?: ExplainableRecommendation | null
}
