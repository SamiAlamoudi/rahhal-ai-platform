import { EntityExtractor } from '../entities/EntityExtractor'
import { IntentEngine } from '../intent/IntentEngine'
import type { TravelIntentId } from '../intent/intents'
import {
  InMemoryConversationMemory,
  InMemoryLongTermMemoryStore,
  SessionRegistry,
  seedLongTerm,
  type ConversationTurn,
  type LongTermMemoryStore,
  type ShortTermMemory,
  type TravelSession,
  type UserSession,
} from '../memory'
import { PreferenceEngine } from '../preferences/PreferenceEngine'
import type { LocaleCode } from '../types'
import { nowIso } from '../types'
import type { TravelDraft } from '../travel/types'

export type TurnInput = {
  text: string
  locale?: LocaleCode
  role?: ConversationTurn['role']
}

export type TurnSnapshot = {
  userSession: UserSession
  travelSession: TravelSession
  intentId: TravelIntentId
  shortTerm: ShortTermMemory
  draft: TravelDraft
}

/**
 * Conversation State Manager — short-term memory, sessions, draft merging.
 * Foundation only: not wired to BrainRouter or UI.
 */
export class ConversationStateManager {
  readonly sessions = new SessionRegistry()
  readonly memory: InMemoryConversationMemory
  readonly longTerm: LongTermMemoryStore
  readonly intents = new IntentEngine()
  readonly entities = new EntityExtractor()
  readonly preferences = new PreferenceEngine()

  private userSessionId: string | null = null
  private travelSessionId: string | null = null

  constructor(options?: {
    memory?: InMemoryConversationMemory
    longTerm?: LongTermMemoryStore
  }) {
    this.memory = options?.memory ?? new InMemoryConversationMemory()
    this.longTerm = options?.longTerm ?? new InMemoryLongTermMemoryStore()
  }

  async start(userId: string, locale: LocaleCode = 'ar'): Promise<TurnSnapshot> {
    const userSession = this.sessions.createUserSession(userId, locale)
    const travelSession = this.sessions.createTravelSession(userId, userSession.id)
    this.userSessionId = userSession.id
    this.travelSessionId = travelSession.id
    this.memory.updateShortTerm(travelSession.id, travelSession.shortTerm)

    const existing = await this.longTerm.get(userId)
    if (!existing) await this.longTerm.put(seedLongTerm(userId))

    return this.snapshot('unknown')
  }

  ingestTurn(input: TurnInput): TurnSnapshot {
    if (!this.travelSessionId || !this.userSessionId) {
      throw new Error('ConversationStateManager.start() required before ingestTurn')
    }

    const locale = input.locale ?? (/[\u0600-\u06FF]/.test(input.text) ? 'ar' : 'en')
    const intent = this.intents.recognize(input.text)
    const extracted = this.entities.extract(input.text)
    this.preferences.observeText(input.text)

    const turn: ConversationTurn = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: input.role ?? 'user',
      text: input.text,
      locale,
      at: nowIso(),
      intentId: intent.id,
    }
    this.memory.appendTurn(this.travelSessionId, turn)

    const draft = this.mergeDraft(extracted)
    const shortTerm = this.memory.getShortTerm(this.travelSessionId) ?? {
      recentTurns: [],
      activeDraft: draft,
      lastMentionedOptions: [],
      unresolvedReferences: [],
    }
    shortTerm.activeDraft = draft
    this.memory.updateShortTerm(this.travelSessionId, shortTerm)
    this.sessions.updateTravelSession(this.travelSessionId, {
      draft,
      shortTerm,
      status: 'planning',
    })

    return this.snapshot(intent.id)
  }

  getTravelSession(): TravelSession | null {
    return this.travelSessionId ? this.sessions.getTravelSession(this.travelSessionId) : null
  }

  private mergeDraft(extracted: ReturnType<EntityExtractor['extract']>): TravelDraft {
    const current = this.getTravelSession()?.draft ?? {}
    return {
      ...current,
      origin: extracted.origin ?? current.origin,
      destination: extracted.destination ?? current.destination,
      departureDate: extracted.dates?.departure ?? current.departureDate,
      returnDate: extracted.dates?.return ?? current.returnDate,
      durationNights: extracted.duration ?? current.durationNights,
      budgetAmount: extracted.budget ?? current.budgetAmount,
      currency: extracted.currency ?? current.currency,
      travellers: extracted.travellers ?? current.travellers,
      hotelClass: extracted.hotelClass ?? current.hotelClass,
      airline: extracted.airline ?? current.airline,
      visaCountry: extracted.visaCountry ?? current.visaCountry,
      transportType: extracted.transportType ?? current.transportType,
      language: extracted.language ?? current.language,
      specialNeeds: extracted.specialNeeds ?? current.specialNeeds,
    }
  }

  private snapshot(intentId: TravelIntentId): TurnSnapshot {
    const userSession = this.sessions.getUserSession(this.userSessionId!)!
    const travelSession = this.sessions.getTravelSession(this.travelSessionId!)!
    const shortTerm =
      this.memory.getShortTerm(travelSession.id) ?? travelSession.shortTerm
    return {
      userSession,
      travelSession,
      intentId,
      shortTerm,
      draft: travelSession.draft,
    }
  }
}
