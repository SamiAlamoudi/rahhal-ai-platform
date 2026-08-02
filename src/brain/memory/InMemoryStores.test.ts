import { describe, expect, it } from 'vitest'
import {
  InMemoryConversationMemory,
  InMemoryLongTermMemoryStore,
  SessionRegistry,
  createEmptyShortTerm,
  seedLongTerm,
} from './InMemoryStores'

describe('memory stores', () => {
  it('manages short-term conversation memory', () => {
    const mem = new InMemoryConversationMemory()
    expect(mem.getShortTerm('s1')).toBeNull()
    mem.appendTurn('s1', {
      id: 't1',
      role: 'user',
      text: 'hi',
      locale: 'en',
      at: '2026-01-01T00:00:00.000Z',
    })
    expect(mem.getTurns('s1')).toHaveLength(1)
    mem.updateShortTerm('s1', { lastMentionedOptions: ['fl-1'] })
    expect(mem.getShortTerm('s1')?.lastMentionedOptions).toEqual(['fl-1'])
    expect(createEmptyShortTerm().recentTurns).toEqual([])
  })

  it('persists long-term records', async () => {
    const lt = new InMemoryLongTermMemoryStore()
    expect(await lt.get('u1')).toBeNull()
    const seed = seedLongTerm('u1')
    await lt.put(seed)
    expect((await lt.get('u1'))?.userId).toBe('u1')
  })

  it('creates and updates sessions', () => {
    const reg = new SessionRegistry()
    const us = reg.createUserSession('u1', 'ar')
    const ts = reg.createTravelSession('u1', us.id)
    expect(reg.getUserSession(us.id)?.activeTravelSessionId).toBe(ts.id)
    expect(reg.getTravelSession(ts.id)?.status).toBe('open')
    expect(reg.updateTravelSession(ts.id, { status: 'planning' })?.status).toBe('planning')
    expect(reg.updateTravelSession('missing', {})).toBeNull()
    expect(reg.getTravelSession('x')).toBeNull()
    expect(reg.getUserSession('x')).toBeNull()
  })
})
