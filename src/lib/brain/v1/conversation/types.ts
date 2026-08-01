/**
 * Sprint 85 — Conversation Manager & Response Generator contracts.
 * Brain v1 island. Gated by `ai.brain.v1`. No UI / Voice / providers / booking.
 *
 * Note: Tool Execution was also delivered under Sprint 85 numbering; this module
 * completes the conversation layer on the same island.
 */

import type { BrainV1Intent, BrainV1PreferenceMemory } from '../types'
import type {
  TravelPlan,
  TravelPlanSlotKey,
  TravelPlanSlots,
  TravelGoal,
} from '../planning/types'

export const CONVERSATION_MANAGER_VERSION = '1.0.0-conversation-manager'

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

export interface ConversationQuestion {
  slot: TravelPlanSlotKey
  priority: number
  questionAr: string
  questionEn: string
  whyAr: string
  whyEn: string
}

export interface ConversationResponse {
  ar: string
  en: string
  tone: 'friendly' | 'clarify' | 'summary' | 'revise' | 'resume' | 'pause'
}

export interface ConversationSummary {
  currentGoal: string
  knownInformation: Array<{ slot: TravelPlanSlotKey | 'intent'; value: string }>
  remainingQuestions: TravelPlanSlotKey[]
  currentRecommendations: string[]
  textAr: string
  textEn: string
}

export interface ConversationConfidence {
  intent: number
  entities: number
  slots: number
  recommendations: number
  overall: number
  lowConfidence: boolean
  needsClarification: boolean
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
  pendingSlots: TravelPlanSlotKey[]
  answeredSlots: TravelPlanSlotKey[]
  turns: ConversationTurnRecord[]
  pausedGoalLabel: string | null
  previousGoalLabel: string | null
  topicStack: string[]
  locale: 'ar' | 'en'
  createdAt: string
  updatedAt: string
  restartedCount: number
}

export interface ConversationManagerInput {
  text: string
  locale?: 'ar' | 'en'
  priorSession?: ConversationSession | null
  /** Pause the conversation without losing slots. */
  pause?: boolean
  /** Explicit resume after pause/interrupt. */
  resume?: boolean
  /** Restart a fresh conversation (clears plan). */
  restart?: boolean
  /** Injectable recommendation blurbs (no providers). */
  recommendations?: string[]
  preferenceMemory?: Partial<BrainV1PreferenceMemory>
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
  revisedSlots: TravelPlanSlotKey[]
  knownSlots: TravelPlanSlots | null
  intent: BrainV1Intent | null
}
