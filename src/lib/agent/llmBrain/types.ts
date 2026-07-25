/**
 * Phase 5 — LLM Conversation Brain models.
 * LLM-first reasoning with rule/regex fallback. No production API required.
 */

import type {
  ConversationIntentKind,
  ExtractedEntities,
  LiveTravelMemory,
} from '../conversationIntelligence'

export type LlmBrainLocale = 'ar' | 'en'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type ArabicDialect =
  | 'saudi'
  | 'gulf'
  | 'yemeni'
  | 'egyptian'
  | 'levant'
  | 'moroccan'
  | 'msa'
  | 'mixed'
  | 'unknown'

export type FactCertainty = 'known' | 'estimated' | 'unknown'

export type ToolDecisionKind =
  | 'search_flights'
  | 'search_hotels'
  | 'ask_question'
  | 'continue_conversation'
  | 'need_weather'
  | 'need_visa'
  | 'need_map'
  | 'need_currency'
  | 'need_itinerary'
  | 'none'

export type ReasoningStageId =
  | 'memory'
  | 'context'
  | 'intent'
  | 'entities'
  | 'travel_reasoning'
  | 'tool_decision'
  | 'compose'
  | 'confidence'

export interface ReasoningStageTrace {
  id: ReasoningStageId
  label: string
  detail: string
  confidence: ConfidenceLevel
  source: 'llm' | 'rules' | 'hybrid'
}

export interface TravelReasoningAspect {
  topic: string
  insight: string
  certainty: FactCertainty
}

export interface TravelReasoningResult {
  destinationStrategy: string | null
  seasonNotes: string[]
  riskNotes: string[]
  travelerNotes: string[]
  flightStrategy: string | null
  hotelStrategy: string | null
  aspects: TravelReasoningAspect[]
  proactiveTips: string[]
}

export interface ToolDecision {
  tool: ToolDecisionKind
  reason: string
  confidence: ConfidenceLevel
  /** Ordered secondary tools */
  alsoConsider: ToolDecisionKind[]
}

export interface ComposedResponse {
  displayText: string
  spokenText: string
  style: 'consultant'
  dialectAware: boolean
}

export interface ConversationStateSnapshot {
  turn: number
  dialect: ArabicDialect
  locale: LlmBrainLocale
  memory: LiveTravelMemory
  lastUserText: string
  compressedFacts: string[]
  openQuestions: string[]
  corrections: string[]
}

export interface LlmBrainDebugTrace {
  stages: ReasoningStageTrace[]
  promptChars: number
  compressed: boolean
  usedFallback: boolean
  providerMode: 'mock_llm' | 'rules_fallback'
}

export interface LlmBrainResult {
  enabled: true
  locale: LlmBrainLocale
  dialect: ArabicDialect
  intent: ConversationIntentKind
  entities: ExtractedEntities
  memory: LiveTravelMemory
  reasoning: TravelReasoningResult
  toolDecision: ToolDecision
  confidence: ConfidenceLevel
  response: ComposedResponse
  state: ConversationStateSnapshot
  debug: LlmBrainDebugTrace
  /** True when Phase 4 rules were used as fallback */
  usedRulesFallback: boolean
}

export interface LlmBrainRunInput {
  userText: string
  priorMemory?: LiveTravelMemory | null
  recentTexts?: string[]
  locale?: LlmBrainLocale
  turn?: number
  /** Force rules fallback (tests). */
  forceRulesFallback?: boolean
  streaming?: boolean
}

export interface LlmBrainMetaSnapshot {
  intent: string
  dialect: ArabicDialect
  confidence: ConfidenceLevel
  primaryTool: ToolDecisionKind
  destination: string | null
  usedRulesFallback: boolean
  providerMode: 'mock_llm' | 'rules_fallback'
  stageCount: number
  proactiveTipCount: number
  responsePreview: string
}
