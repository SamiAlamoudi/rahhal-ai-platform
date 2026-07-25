/**
 * Phase 3 Stage 2 — Multi-Turn Conversation Manager memory contracts.
 * Conversation management only. No planning / scoring algorithms.
 */

import type { ConfidenceBand, ConversationLocale } from './types'
import { clamp01, isoNow, uniqueStrings } from './types'

export type ConversationTopic =
  | 'trip_planning'
  | 'destination_research'
  | 'budget_discussion'
  | 'transportation'
  | 'accommodation'
  | 'activities'
  | 'visa'
  | 'weather'
  | 'general_travel'
  | 'recommendation'

export type ConversationTurnEvent =
  | 'continuing'
  | 'new_trip'
  | 'changing_destination'
  | 'changing_budget'
  | 'changing_dates'
  | 'changing_travelers'
  | 'correcting_information'
  | 'follow_up'
  | 'switching_topics'
  | 'resuming'

export interface TravelerFacts {
  adults?: number | null
  children?: number | null
  origin?: string | null
  tripPurpose?: string | null
  interests?: string[]
  travelerNotes?: string[]
}

export interface DestinationFacts {
  destination?: string | null
  compareWith?: string | null
  regionHint?: string | null
  destinationNotes?: string[]
}

export interface StrategyFacts {
  budgetAmount?: number | null
  budgetCurrency?: string | null
  durationDays?: number | null
  monthHint?: number | null
  pace?: string | null
  strategyNotes?: string[]
}

export interface UserCorrectionRecord {
  field: string
  previousValue: string | null
  nextValue: string
  turnNumber: number
  at: string
}

export interface MultiTurnHistoryEntry {
  turnNumber: number
  role: 'user' | 'assistant'
  text: string
  topic: ConversationTopic | null
  event: ConversationTurnEvent | null
  at: string
}

/** Short-term: recent raw turns (sliding window). */
export interface ShortTermMemory {
  recentTurns: MultiTurnHistoryEntry[]
}

/** Working memory: active dialogue focus. */
export interface WorkingMemory {
  activeGoal: string | null
  conversationTopic: ConversationTopic | null
  tripGoal: string | null
  pendingClarification: string | null
  missingInformation: string[]
  answeredQuestions: string[]
  resolvedClarifications: string[]
}

/** Long-term: extracted durable facts + corrections. */
export interface LongTermMemory {
  travelerFacts: TravelerFacts
  destinationFacts: DestinationFacts
  strategyFacts: StrategyFacts
  userCorrections: UserCorrectionRecord[]
}

export interface MultiTurnConversationSession {
  conversationId: string
  sessionId: string
  locale: ConversationLocale
  turnNumber: number
  activeGoal: string | null
  conversationTopic: ConversationTopic | null
  tripGoal: string | null
  conversationHistory: MultiTurnHistoryEntry[]
  answeredQuestions: string[]
  missingInformation: string[]
  pendingClarification: string | null
  resolvedClarifications: string[]
  travelerFacts: TravelerFacts
  destinationFacts: DestinationFacts
  strategyFacts: StrategyFacts
  userCorrections: UserCorrectionRecord[]
  conversationSummary: string
  shortTerm: ShortTermMemory
  working: WorkingMemory
  longTerm: LongTermMemory
  updatedAt: string
  createdAt: string
}

export interface MultiTurnManagerInput {
  conversationId: string
  sessionId?: string
  userText: string
  locale?: ConversationLocale
  /** Production assistant reply (used when orchestrator is OFF). */
  productionReply?: string
  tripPlan?: unknown
  requirements?: unknown
  toolResults?: unknown[]
  signal?: AbortSignal
  enabled?: boolean
  /** When true, invoke Stage 1 Conversation Orchestrator for reply composition. */
  conversationOrchestratorEnabled?: boolean
  now?: Date
}

export interface MultiTurnManagerResult {
  enabled: true
  conversationId: string
  sessionId: string
  turnNumber: number
  topic: ConversationTopic
  event: ConversationTurnEvent
  activeGoal: string | null
  tripGoal: string | null
  confidence: number
  confidenceBand: ConfidenceBand
  reply: string
  spokenText: string
  pendingClarification: string | null
  missingInformation: string[]
  session: MultiTurnConversationSession
  summarized: boolean
  recovered: boolean
}

export function emptyTravelerFacts(): TravelerFacts {
  return { interests: [], travelerNotes: [] }
}

export function emptyDestinationFacts(): DestinationFacts {
  return { destinationNotes: [] }
}

export function emptyStrategyFacts(): StrategyFacts {
  return { strategyNotes: [] }
}

export function createEmptyMultiTurnSession(
  conversationId: string,
  options?: { sessionId?: string; locale?: ConversationLocale; now?: Date },
): MultiTurnConversationSession {
  const now = isoNow(options?.now)
  const locale = options?.locale === 'en' ? 'en' : 'ar'
  const sessionId =
    options?.sessionId?.trim()
    || `session-${conversationId}`
  const travelerFacts = emptyTravelerFacts()
  const destinationFacts = emptyDestinationFacts()
  const strategyFacts = emptyStrategyFacts()
  return {
    conversationId,
    sessionId,
    locale,
    turnNumber: 0,
    activeGoal: null,
    conversationTopic: null,
    tripGoal: null,
    conversationHistory: [],
    answeredQuestions: [],
    missingInformation: [],
    pendingClarification: null,
    resolvedClarifications: [],
    travelerFacts,
    destinationFacts,
    strategyFacts,
    userCorrections: [],
    conversationSummary: '',
    shortTerm: { recentTurns: [] },
    working: {
      activeGoal: null,
      conversationTopic: null,
      tripGoal: null,
      pendingClarification: null,
      missingInformation: [],
      answeredQuestions: [],
      resolvedClarifications: [],
    },
    longTerm: {
      travelerFacts: { ...travelerFacts, interests: [], travelerNotes: [] },
      destinationFacts: { ...destinationFacts, destinationNotes: [] },
      strategyFacts: { ...strategyFacts, strategyNotes: [] },
      userCorrections: [],
    },
    updatedAt: now,
    createdAt: now,
  }
}

export function cloneMultiTurnSession(
  session: MultiTurnConversationSession,
): MultiTurnConversationSession {
  return {
    ...session,
    conversationHistory: session.conversationHistory.map((t) => ({ ...t })),
    answeredQuestions: [...session.answeredQuestions],
    missingInformation: [...session.missingInformation],
    resolvedClarifications: [...session.resolvedClarifications],
    travelerFacts: {
      ...session.travelerFacts,
      interests: [...(session.travelerFacts.interests ?? [])],
      travelerNotes: [...(session.travelerFacts.travelerNotes ?? [])],
    },
    destinationFacts: {
      ...session.destinationFacts,
      destinationNotes: [...(session.destinationFacts.destinationNotes ?? [])],
    },
    strategyFacts: {
      ...session.strategyFacts,
      strategyNotes: [...(session.strategyFacts.strategyNotes ?? [])],
    },
    userCorrections: session.userCorrections.map((c) => ({ ...c })),
    shortTerm: {
      recentTurns: session.shortTerm.recentTurns.map((t) => ({ ...t })),
    },
    working: {
      ...session.working,
      missingInformation: [...session.working.missingInformation],
      answeredQuestions: [...session.working.answeredQuestions],
      resolvedClarifications: [...session.working.resolvedClarifications],
    },
    longTerm: {
      travelerFacts: {
        ...session.longTerm.travelerFacts,
        interests: [...(session.longTerm.travelerFacts.interests ?? [])],
        travelerNotes: [...(session.longTerm.travelerFacts.travelerNotes ?? [])],
      },
      destinationFacts: {
        ...session.longTerm.destinationFacts,
        destinationNotes: [...(session.longTerm.destinationFacts.destinationNotes ?? [])],
      },
      strategyFacts: {
        ...session.longTerm.strategyFacts,
        strategyNotes: [...(session.longTerm.strategyFacts.strategyNotes ?? [])],
      },
      userCorrections: session.longTerm.userCorrections.map((c) => ({ ...c })),
    },
  }
}

export function syncWorkingFromSession(
  session: MultiTurnConversationSession,
): MultiTurnConversationSession {
  return {
    ...session,
    working: {
      activeGoal: session.activeGoal,
      conversationTopic: session.conversationTopic,
      tripGoal: session.tripGoal,
      pendingClarification: session.pendingClarification,
      missingInformation: [...session.missingInformation],
      answeredQuestions: [...session.answeredQuestions],
      resolvedClarifications: [...session.resolvedClarifications],
    },
    longTerm: {
      travelerFacts: {
        ...session.travelerFacts,
        interests: [...(session.travelerFacts.interests ?? [])],
        travelerNotes: [...(session.travelerFacts.travelerNotes ?? [])],
      },
      destinationFacts: {
        ...session.destinationFacts,
        destinationNotes: [...(session.destinationFacts.destinationNotes ?? [])],
      },
      strategyFacts: {
        ...session.strategyFacts,
        strategyNotes: [...(session.strategyFacts.strategyNotes ?? [])],
      },
      userCorrections: session.userCorrections.map((c) => ({ ...c })),
    },
    shortTerm: {
      recentTurns: session.conversationHistory.slice(-8).map((t) => ({ ...t })),
    },
  }
}

export { clamp01, isoNow, uniqueStrings }
