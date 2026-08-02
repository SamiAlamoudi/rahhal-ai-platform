import type { BrainId, LocaleCode } from '../types'
import type { TravelDraft } from '../travel/types'
import type { TravelIntentId } from '../intent/intents'
import type { UserPreferenceProfile } from '../preferences/types'

export type MemoryRole = 'user' | 'assistant' | 'system'

export type ConversationTurn = {
  id: BrainId
  role: MemoryRole
  text: string
  locale: LocaleCode
  at: string
  intentId?: TravelIntentId
}

/** Ephemeral working memory for the active dialogue. */
export type ShortTermMemory = {
  recentTurns: ConversationTurn[]
  activeDraft: TravelDraft
  lastMentionedOptions: string[]
  unresolvedReferences: string[]
}

/** Durable preferences / facts — interface only at foundation. */
export type LongTermMemoryRecord = {
  userId: string
  facts: Record<string, string>
  preferenceProfile: UserPreferenceProfile
  updatedAt: string
}

export interface LongTermMemoryStore {
  get(userId: string): Promise<LongTermMemoryRecord | null>
  put(record: LongTermMemoryRecord): Promise<void>
}

export type TravelSession = {
  id: BrainId
  userId: string
  createdAt: string
  updatedAt: string
  draft: TravelDraft
  shortTerm: ShortTermMemory
  status: 'open' | 'planning' | 'closed'
}

export type UserSession = {
  id: BrainId
  userId: string
  locale: LocaleCode
  startedAt: string
  activeTravelSessionId?: BrainId
}

export interface ConversationMemoryPort {
  appendTurn(sessionId: string, turn: ConversationTurn): void
  getTurns(sessionId: string): ConversationTurn[]
  getShortTerm(sessionId: string): ShortTermMemory | null
  updateShortTerm(sessionId: string, patch: Partial<ShortTermMemory>): void
}
