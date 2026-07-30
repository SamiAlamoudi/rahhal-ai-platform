import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { extractFromUserText } from '../agent/extractRequirements'
import { resetFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'

const ARABIC_BOOKING =
  'أريد السفر من الرياض إلى طوكيو من 3 أغسطس إلى 13 أغسطس لشخصين درجة رجال الأعمال.'

function userMessage(content: string, conversationId: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'user',
    modality: 'audio',
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

describe('Arabic booking → search first (fresh conversation)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  it('extract intent is plan (not answer consult path)', () => {
    const r = extractFromUserText(ARABIC_BOOKING, 'ar')
    expect(r.intent).toBe('plan')
    expect(r.patch.destination).toBe('Tokyo')
    expect(r.patch.destinationCountry).toBe('Japan')
    expect(r.patch.origin).toBe('Riyadh')
    expect(r.patch.travelers).toBe(2)
    expect(r.patch.cabinPreference).toBe('business')
  })

  it('planTurn on empty memory searches and presents options (no Jordan/Dubai/advice)', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: false,
    })
    const conversationId = `fresh-tokyo-${Date.now()}`
    const result = await service.planTurn({
      conversationId,
      messages: [userMessage(ARABIC_BOOKING, conversationId)],
    })

    const mem = result.memory.requirements
    expect(mem.origin).toBe('Riyadh')
    expect(mem.destination).toBe('Tokyo')
    expect(mem.destinationCity).toBe('Tokyo')
    expect(mem.destinationCountry).toBe('Japan')
    expect(mem.travelers).toBe(2)
    expect(mem.cabinPreference).toBe('business')
    expect(mem.startDate).toMatch(/-08-03$/)
    expect(mem.endDate).toMatch(/-08-13$/)
    expect(mem.destinations).toEqual(['Tokyo'])

    // Must have run search / built a plan — not stuck in consult.
    expect(result.memory.phase).toBe('planned')
    expect(result.tripPlan).toBeTruthy()
    expect(result.tripPlan?.destinations?.join(' ')).toMatch(/Tokyo/i)
    expect(result.tripPlan?.destinations?.join(' ')).not.toMatch(/Jordan|الأردن|Dubai|Morocco|المغرب/i)

    const flights = result.tripPlan?.flights ?? []
    const toolFlights = (result.meta.toolResults ?? []).some((t) =>
      /flight/i.test(String(t.tool || '')) || /flight/i.test(String(t.summary || '')),
    )
    // Options on plan and/or tool results — booking search happened.
    expect(flights.length > 0 || toolFlights || (result.meta.toolResults?.length ?? 0) > 0).toBe(true)

    const reply = `${result.reply}\n${result.meta.spokenText || ''}`
    expect(reply).not.toMatch(/Jordan|الأردن|Dubai|Morocco|المغرب|أنصح|أقترح|I suggest|I recommend|Perhaps|Let's first determine|خلنا نحدد أولاً/i)
    // At most one question mark in the booking-agent reply.
    const questions = (reply.match(/[؟?]/g) || []).length
    expect(questions).toBeLessThanOrEqual(1)
  }, 60_000)
})
