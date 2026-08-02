import type {
  ConversationMemoryPort,
  ConversationTurn,
  LongTermMemoryRecord,
  LongTermMemoryStore,
  ShortTermMemory,
  TravelSession,
  UserSession,
} from './types'
import { emptyPreferenceProfile } from '../preferences/types'
import { nowIso } from '../types'

export function createEmptyShortTerm(): ShortTermMemory {
  return {
    recentTurns: [],
    activeDraft: {},
    lastMentionedOptions: [],
    unresolvedReferences: [],
  }
}

export class InMemoryConversationMemory implements ConversationMemoryPort {
  private readonly bySession = new Map<string, ShortTermMemory>()

  private ensure(sessionId: string): ShortTermMemory {
    let stm = this.bySession.get(sessionId)
    if (!stm) {
      stm = createEmptyShortTerm()
      this.bySession.set(sessionId, stm)
    }
    return stm
  }

  appendTurn(sessionId: string, turn: ConversationTurn): void {
    const stm = this.ensure(sessionId)
    stm.recentTurns = [...stm.recentTurns, turn].slice(-40)
  }

  getTurns(sessionId: string): ConversationTurn[] {
    return this.ensure(sessionId).recentTurns
  }

  getShortTerm(sessionId: string): ShortTermMemory | null {
    return this.bySession.get(sessionId) ?? null
  }

  updateShortTerm(sessionId: string, patch: Partial<ShortTermMemory>): void {
    const stm = this.ensure(sessionId)
    Object.assign(stm, patch)
  }
}

export class InMemoryLongTermMemoryStore implements LongTermMemoryStore {
  private readonly byUser = new Map<string, LongTermMemoryRecord>()

  async get(userId: string): Promise<LongTermMemoryRecord | null> {
    return this.byUser.get(userId) ?? null
  }

  async put(record: LongTermMemoryRecord): Promise<void> {
    this.byUser.set(record.userId, record)
  }
}

export class SessionRegistry {
  private readonly travel = new Map<string, TravelSession>()
  private readonly users = new Map<string, UserSession>()

  createUserSession(userId: string, locale: UserSession['locale']): UserSession {
    const session: UserSession = {
      id: `us-${userId}-${this.users.size + 1}`,
      userId,
      locale,
      startedAt: nowIso(),
    }
    this.users.set(session.id, session)
    return session
  }

  createTravelSession(userId: string, userSessionId?: string): TravelSession {
    const id = `ts-${userId}-${this.travel.size + 1}`
    const session: TravelSession = {
      id,
      userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      draft: {},
      shortTerm: createEmptyShortTerm(),
      status: 'open',
    }
    this.travel.set(id, session)
    if (userSessionId) {
      const us = this.users.get(userSessionId)
      if (us) us.activeTravelSessionId = id
    }
    return session
  }

  getTravelSession(id: string): TravelSession | null {
    return this.travel.get(id) ?? null
  }

  getUserSession(id: string): UserSession | null {
    return this.users.get(id) ?? null
  }

  updateTravelSession(id: string, patch: Partial<TravelSession>): TravelSession | null {
    const current = this.travel.get(id)
    if (!current) return null
    const next = { ...current, ...patch, updatedAt: nowIso() }
    this.travel.set(id, next)
    return next
  }
}

export function seedLongTerm(userId: string): LongTermMemoryRecord {
  return {
    userId,
    facts: {},
    preferenceProfile: emptyPreferenceProfile(),
    updatedAt: nowIso(),
  }
}
