/**
 * Bilamo Intelligence Layer — end-to-end traveler conversations.
 *
 * Exercises the full product spine:
 *   natural language → memory → clarification → orchestration → recommendation → response
 * via createTravelAgentProvider (bilamoIntelligenceEnabled: true) + streaming.
 */

import { describe, expect, it } from 'vitest'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import type { AgentProviderMeta } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

type TurnResult = {
  text: string
  meta: AgentProviderMeta
  deltas: string[]
  spokenFromStream: string[]
}

function userMessage(conversationId: string, content: string, index: number): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${index}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

function assistantMessage(
  conversationId: string,
  content: string,
  meta: AgentProviderMeta,
  index: number,
): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `a-${index}`,
    conversationId,
    role: 'assistant',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: meta as unknown as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
  }
}

async function playTurn(
  provider: ReturnType<typeof createTravelAgentProvider>,
  conversationId: string,
  history: ChatMessage[],
  userText: string,
): Promise<TurnResult> {
  const nextUser = userMessage(conversationId, userText, history.length)
  const messages = [...history, nextUser]
  const deltas: string[] = []
  const spokenFromStream: string[] = []
  let doneMeta: AgentProviderMeta | null = null
  let doneText = ''

  for await (const chunk of provider.streamReply({
    conversationId,
    messages,
    signal: new AbortController().signal,
  })) {
    if (chunk.type === 'delta') {
      if (chunk.text) deltas.push(chunk.text)
      const spoken = (chunk.meta as { spokenText?: string } | undefined)?.spokenText
      if (spoken) spokenFromStream.push(spoken)
    }
    if (chunk.type === 'done') {
      doneMeta = chunk.meta as unknown as AgentProviderMeta
      const display = (chunk.meta as { displayText?: string } | undefined)?.displayText
      doneText = (typeof display === 'string' && display.trim())
        ? display
        : deltas.join('')
    }
    if (chunk.type === 'error') {
      throw new Error(chunk.error || 'stream error')
    }
  }

  if (!doneMeta) throw new Error('missing done meta')

  const finalText = (doneText || deltas.join('') || doneMeta.spokenText || '').trim()

  return {
    text: finalText,
    meta: doneMeta,
    deltas,
    spokenFromStream,
  }
}

/** Multi-turn conversation driver — accumulates history like a real session. */
async function converse(
  lines: string[],
  conversationId = `bilamo-e2e-${Date.now()}`,
): Promise<{ turns: TurnResult[]; history: ChatMessage[] }> {
  const provider = createTravelAgentProvider({ bilamoIntelligenceEnabled: true })
  const history: ChatMessage[] = []
  const turns: TurnResult[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const turn = await playTurn(provider, conversationId, history, lines[i])
    turns.push(turn)
    history.push(userMessage(conversationId, lines[i], history.length))
    history.push(assistantMessage(conversationId, turn.text, turn.meta, history.length))
  }

  return { turns, history }
}

type BilamoSearchFlight = {
  id: string
  airline: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  duration: string
  stopsLabel: string
  price: number
  currency: string
  reason: string
  score: number
}

type BilamoSearchHotel = {
  id: string
  name: string
  area: string
  rating: number
  nightsLabel: string
  price: number
  currency: string
  reason: string
  score?: number
}

type BilamoMeta = NonNullable<AgentProviderMeta['bilamo']> & {
  search: {
    flights: BilamoSearchFlight[]
    hotels: BilamoSearchHotel[]
    context: Record<string, unknown>
    timeline: Array<Record<string, unknown>>
  } | null
}

function bilamo(meta: AgentProviderMeta): BilamoMeta {
  expect(meta.kind).toBe('travel_agent')
  expect(meta.bilamo).toBeTruthy()
  return meta.bilamo as BilamoMeta
}

function assertConsultantVoice(meta: AgentProviderMeta, text: string) {
  const spoken = meta.spokenText?.trim() || ''
  expect(spoken.length).toBeGreaterThan(0)
  expect(spoken.split(/\s+/).length).toBeLessThan(45)
  expect(text.toLowerCase()).not.toMatch(/\{"|raw json|undefined|null\}/)
  expect(text.toLowerCase()).not.toMatch(/\bbudget\b.*\?/)
}

describe('Bilamo Intelligence E2E — real traveler conversations', () => {
  it('Japan multi-turn: NL → clarify dates → orchestrate → recommend (solo soft-default)', async () => {
    const { turns } = await converse([
      'I want to travel to Japan.',
      'About 7 days next April.',
    ])

    // Turn 1 — destination extracted, only dates asked
    const t1 = turns[0]
    const b1 = bilamo(t1.meta)
    expect(t1.meta.memory.requirements.destination).toMatch(/Japan/i)
    expect(b1.phase).toBe('collecting')
    expect(b1.askedSlot).toBe('dates')
    expect(b1.askedSlots).toContain('dates')
    expect(t1.text.toLowerCase()).toMatch(/when|day|date/)
    expect(t1.text.toLowerCase()).not.toMatch(/budget/)
    // Dates question may say "how many days" — must not ask travelers (soft-defaulted).
    expect(t1.text.toLowerCase()).not.toMatch(/solo|with someone|how many travelers/)
    expect(b1.search).toBeNull()
    assertConsultantVoice(t1.meta, t1.text)

    // Turn 2 — dates remembered → search + recommendation (travelers assumed solo)
    const t2 = turns[1]
    const b2 = bilamo(t2.meta)
    expect(t2.meta.memory.requirements.destination).toMatch(/Japan/i)
    expect(t2.meta.memory.requirements.durationDays).toBe(7)
    expect(t2.meta.memory.requirements.travelers).toBe(1)
    expect(b2.phase).toBe('recommending')
    expect(b2.askedSlot).toBeNull()
    expect(b2.search).toBeTruthy()
    expect(t2.text.toLowerCase()).toMatch(/solo|assumed/)
    expect(t2.text.toLowerCase()).not.toMatch(/budget/)

    const search = b2.search!
    expect(search.flights.length).toBeGreaterThanOrEqual(2)
    expect(search.hotels.length).toBeGreaterThanOrEqual(1)
    expect(search.context.weather).toBeTruthy()
    expect(search.context.visa).toBeTruthy()
    expect(search.context.currency).toBeTruthy()
    expect(search.context.transfer).toBeTruthy()
    expect(search.context.timeDifference).toBeTruthy()
    expect(search.timeline.length).toBeGreaterThan(0)
    expect(search.flights[0].reason).toBeTruthy()

    // Recommendation presentation — explain #1, alternatives, no raw dump
    expect(t2.text.toLowerCase()).toMatch(/japan|choose|option|suggest|why/)
    expect(t2.text.toLowerCase()).toMatch(/alternative|if you prefer|strong alternative/)
    expect(t2.meta.bookingSearch?.searchInvoked).toBe(true)
    expect(t2.meta.bookingOptions?.length).toBeGreaterThan(0)
    expect(t2.meta.tripPlan?.destinations?.[0]).toMatch(/Japan/i)
    expect(t2.meta.tripPlan?.accommodations?.length).toBeGreaterThan(0)
    assertConsultantVoice(t2.meta, t2.text)

    // Streaming happened (dialogue deltas)
    expect(t2.deltas.length).toBeGreaterThan(0)
  })

  it('one-shot complete request skips unnecessary questions and returns unified search', async () => {
    const { turns } = await converse([
      'Plan 5 days in Istanbul for 2 travelers from Riyadh. Prefer Saudia, business class.',
    ])
    const t = turns[0]
    const b = bilamo(t.meta)

    expect(b.phase).toBe('recommending')
    expect(b.askedSlot).toBeNull()
    expect(t.meta.memory.requirements.destination).toMatch(/Istanbul/i)
    expect(t.meta.memory.requirements.durationDays).toBe(5)
    expect(t.meta.memory.requirements.travelers).toBe(2)
    expect(t.meta.memory.requirements.origin).toMatch(/Riyadh|RUH/i)
    expect(t.meta.memory.requirements.preferredAirline?.toLowerCase()).toMatch(/saudia|^sv$/)
    expect(t.meta.memory.requirements.cabinPreference).toMatch(/business/i)

    // Preferences remembered on bilamo memory
    expect(b.preferences.origin).toBeTruthy()
    expect(String(b.preferences.preferredAirline || '').toLowerCase()).toMatch(/saudia|^sv$/)
    expect(String(b.preferences.seatClass || '')).toMatch(/business/i)

    expect(b.search?.flights.length).toBeGreaterThan(0)
    expect(b.search?.hotels.length).toBeGreaterThan(0)
    expect(b.search?.flights[0].airline.toLowerCase()).toMatch(/saudia/)
    expect(t.text.toLowerCase()).not.toMatch(/budget\?|what budget/)
    assertConsultantVoice(t.meta, t.text)
  })

  it('never asks budget and never re-asks destination after it was given', async () => {
    const { turns } = await converse([
      'I want to go to Paris.',
      '6 days in September for just me.',
    ])

    for (const turn of turns) {
      expect(turn.text.toLowerCase()).not.toMatch(/what budget|budget range|ميزانية/)
      const asked = bilamo(turn.meta).askedSlot
      if (asked) expect(asked).not.toBe('destination')
    }

    const last = turns[turns.length - 1]
    expect(bilamo(last.meta).phase).toBe('recommending')
    expect(last.meta.memory.requirements.destination).toMatch(/Paris/i)
    expect(last.meta.memory.requirements.travelers).toBe(1)
    expect(last.meta.memory.requirements.durationDays).toBe(6)
  })

  it('greeting opens like a consultant and only asks destination', async () => {
    const { turns } = await converse(['Hello'])
    const t = turns[0]
    const b = bilamo(t.meta)
    expect(b.phase).toBe('greeting')
    expect(b.askedSlot).toBe('destination')
    expect(t.text.toLowerCase()).toMatch(/bilamo|welcome|where/)
    expect(t.text.toLowerCase()).not.toMatch(/budget|how many days/)
    assertConsultantVoice(t.meta, t.text)
  })

  it('Arabic traveler path: extract → clarify → recommend with memory', async () => {
    const { turns } = await converse([
      'أبي أسافر لليابان',
      '٧ أيام لشخصين',
    ])

    const t1 = turns[0]
    const dest1 = String(t1.meta.memory.requirements.destination || '')
    expect(dest1).toMatch(/Japan|اليابان|Tokyo|طوكيو/i)
    expect(bilamo(t1.meta).askedSlot).toBeTruthy()
    expect(t1.text).not.toMatch(/budget|ميزانية\s*\?/)

    const t2 = turns[1]
    const b2 = bilamo(t2.meta)
    const dest2 = String(t2.meta.memory.requirements.destination || '')
    expect(dest2).toMatch(/Japan|اليابان|Tokyo|طوكيو/i)
    expect(t2.meta.memory.requirements.durationDays).toBe(7)
    expect(t2.meta.memory.requirements.travelers).toBe(2)
    expect(b2.phase).toBe('recommending')
    expect(b2.search?.flights.length).toBeGreaterThan(0)
    expect(t2.meta.spokenText).toBeTruthy()
  })

  it('remembers origin and airline across turns without re-asking soft prefs', async () => {
    const { turns } = await converse([
      'Trip to Dubai from Jeddah, I prefer Emirates.',
      '4 days, two travelers.',
    ])

    const last = turns[turns.length - 1]
    const req = last.meta.memory.requirements
    expect(req.destination).toMatch(/Dubai/i)
    expect(req.origin).toMatch(/Jeddah/i)
    expect(req.preferredAirline?.toLowerCase()).toMatch(/emirates|^ek$/)
    expect(req.durationDays).toBe(4)
    expect(req.travelers).toBe(2)

    const prefs = bilamo(last.meta).preferences
    expect(String(prefs.origin || '')).toMatch(/Jeddah/i)
    expect(String(prefs.preferredAirline || '').toLowerCase()).toMatch(/emirates|^ek$/)

    // Soft prefs must never appear as the asked slot
    for (const turn of turns) {
      const slot = bilamo(turn.meta).askedSlot
      expect(slot === null || slot === 'destination' || slot === 'dates' || slot === 'travelers').toBe(true)
      expect(turn.text.toLowerCase()).not.toMatch(/which airline|hotel preference\?|seat class\?/)
    }

    expect(bilamo(last.meta).phase).toBe('recommending')
    expect(bilamo(last.meta).search?.flights[0].airline.toLowerCase()).toMatch(/emirates/)
  })

  it('recommendation payload matches Bilamo UI card contract', async () => {
    const { turns } = await converse([
      '5 nights in Lisbon for 2 adults starting next month',
    ])
    const search = bilamo(turns[0].meta).search
    expect(search).toBeTruthy()

    for (const flight of search!.flights) {
      expect(flight).toEqual(expect.objectContaining({
        id: expect.any(String),
        airline: expect.any(String),
        origin: expect.any(String),
        destination: expect.any(String),
        departTime: expect.any(String),
        arriveTime: expect.any(String),
        duration: expect.any(String),
        stopsLabel: expect.any(String),
        price: expect.any(Number),
        currency: expect.any(String),
        reason: expect.any(String),
      }))
    }
    for (const hotel of search!.hotels) {
      expect(hotel).toEqual(expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        area: expect.any(String),
        rating: expect.any(Number),
        nightsLabel: expect.any(String),
        price: expect.any(Number),
        currency: expect.any(String),
        reason: expect.any(String),
      }))
    }
    expect(search!.timeline[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      time: expect.any(String),
      title: expect.any(String),
    }))

    // Option #1 should outrank alternatives
    expect(search!.flights[0].score).toBeGreaterThan(search!.flights[1]?.score ?? 0)
  })

  it('streams consultant phrases before the final recommendation', async () => {
    const provider = createTravelAgentProvider({ bilamoIntelligenceEnabled: true })
    const conversationId = `bilamo-stream-${Date.now()}`
    const deltas: string[] = []
    const spoken: string[] = []

    for await (const chunk of provider.streamReply({
      conversationId,
      messages: [userMessage(conversationId, '7 days in Japan for 2 travelers', 0)],
      signal: new AbortController().signal,
    })) {
      if (chunk.type === 'delta') {
        if (chunk.text) deltas.push(chunk.text)
        const s = (chunk.meta as { spokenText?: string } | undefined)?.spokenText
        if (s) spoken.push(s)
      }
    }

    expect(deltas.length).toBeGreaterThan(1)
    expect(spoken.length).toBeGreaterThan(0)
    const full = deltas.join('')
    expect(full.toLowerCase()).toMatch(/japan|option|choose|hotel|flight|airline/)
  })
})
