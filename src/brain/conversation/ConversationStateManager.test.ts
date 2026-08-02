import { describe, expect, it } from 'vitest'
import { ConversationStateManager } from './ConversationStateManager'

describe('ConversationStateManager', () => {
  it('requires start before ingest', () => {
    const csm = new ConversationStateManager()
    expect(() => csm.ingestTurn({ text: 'hi' })).toThrow(/start/)
  })

  it('tracks sessions, intent, draft across turns', async () => {
    const csm = new ConversationStateManager()
    const first = await csm.start('user-a', 'ar')
    expect(first.travelSession.status).toBe('open')
    const snap = csm.ingestTurn({
      text: 'حجز طيران من الرياض إلى إسطنبول لمدة 4 ليالي بميزانية 6000 ريال',
    })
    expect(snap.intentId).toBe('book_flight')
    expect(snap.draft.origin).toBe('Riyadh')
    expect(snap.draft.destination).toBe('Istanbul')
    expect(snap.draft.durationNights).toBe(4)
    expect(snap.shortTerm.recentTurns.length).toBe(1)
    expect(csm.getTravelSession()?.status).toBe('planning')

    csm.ingestTurn({ text: '5 star hotel Emirates', locale: 'en', role: 'user' })
    expect(csm.getTravelSession()?.draft.hotelClass).toBe(5)
    expect(csm.getTravelSession()?.draft.airline?.toLowerCase()).toContain('emirates')
  })
})
