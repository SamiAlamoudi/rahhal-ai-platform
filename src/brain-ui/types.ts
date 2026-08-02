import type { BrainTurnTrace, BrainRecommendationsBundle } from '../brain'
import type { BrainErrorCode, LocaleCode } from '../brain/types'
import type { TravelSession } from '../brain/memory/types'
import type { UserPreferenceProfile } from '../brain/preferences/types'
import type { TimelineItem } from '../brain/timeline/TimelineBuilder'
import type { ReasonerReport } from '../brain/reasoner/TravelReasoner'
import type { BrainDecision } from '../brain/decision/DecisionEngine'
import type { ShortTermMemory } from '../brain/memory/types'
import type { ConciergeBundle } from '../concierge'

export type BrainLoadingPhase =
  | 'idle'
  | 'thinking'
  | 'reasoning'
  | 'planning'
  | 'comparing'
  | 'choosing'
  | 'preparing'

export type ConversationMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  at: string
  streaming?: boolean
}

export type ConversationTimelineStep =
  | { id: string; kind: 'user_ask'; text: string }
  | { id: string; kind: 'brain_reasoning'; text: string }
  | { id: string; kind: 'decision'; text: string }
  | { id: string; kind: 'recommendation'; text: string }
  | { id: string; kind: 'summary'; text: string }

export type BrainUiError = {
  code: BrainErrorCode | 'unknown_destination' | 'budget_conflict'
  message: string
  missingFields?: string[]
}

export type RecentConversationSummary = {
  id: string
  title: string
  preview: string
  updatedAt: string
}

export type SuggestedJourney = {
  id: string
  title: string
  subtitle: string
  prompt: string
}

export type BrainUiState = {
  ready: boolean
  locale: LocaleCode
  loading: boolean
  thinking: boolean
  loadingPhase: BrainLoadingPhase
  voiceListening: boolean
  messages: ConversationMessage[]
  travelSession: TravelSession | null
  memory: ShortTermMemory | null
  reasoning: ReasonerReport | null
  decision: BrainDecision | null
  recommendations: BrainRecommendationsBundle | null
  timeline: TimelineItem[]
  conversationTimeline: ConversationTimelineStep[]
  preferences: UserPreferenceProfile | null
  lastTrace: BrainTurnTrace | null
  error: BrainUiError | null
  recentConversations: RecentConversationSummary[]
  suggestedJourneys: SuggestedJourney[]
  developerMode: boolean
  /** Luxury concierge intelligence snapshot (mock). */
  concierge: ConciergeBundle | null
}
