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

  it('planTurn searches and returns ≥3 selectable Tokyo flight cards (no estimated-total speech)', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: true,
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

    expect(result.memory.phase).toBe('planned')
    expect(result.tripPlan).toBeTruthy()
    expect(result.tripPlan?.destinations?.join(' ')).toMatch(/Tokyo/i)
    expect(result.tripPlan?.destinations?.join(' ')).not.toMatch(/Jordan|الأردن|Dubai|Morocco|المغرب/i)

    const search = result.meta.bookingSearch
    expect(search).toBeTruthy()
    expect(search?.searchInvoked).toBe(true)
    expect(search?.destination).toMatch(/Tokyo/i)
    expect(search?.origin).toMatch(/Riyadh/i)
    expect(search?.travelers).toBe(2)
    expect(search?.cabin).toMatch(/business/i)
    expect(search?.providerFlightCount).toBeGreaterThanOrEqual(3)
    expect(search?.normalizedFlightCount).toBeGreaterThanOrEqual(3)
    expect(search?.cardsRenderedCount).toBeGreaterThanOrEqual(3)

    const flights = (result.meta.bookingOptions ?? []).filter((o) => o.kind === 'flight')
    expect(flights.length).toBeGreaterThanOrEqual(3)
    for (const card of flights.slice(0, 3)) {
      expect(card.airline).toBeTruthy()
      expect(card.departureTime).toBeTruthy()
      expect(card.arrivalTime).toBeTruthy()
      expect(card.stops == null || typeof card.stops === 'number').toBe(true)
      expect(card.durationMinutes == null || typeof card.durationMinutes === 'number').toBe(true)
      expect(card.cabin).toMatch(/business/i)
      expect(typeof card.price).toBe('number')
      expect(card.currency).toBeTruthy()
      expect(card.provider).toBeTruthy()
      expect(card.selectable).toBe(true)
      expect(`${card.from} ${card.to}`).toMatch(/HND|NRT|TYO|Tokyo|RUH/i)
    }

    const providerFlights = (result.tripPlan?.flights ?? []).filter((f) => f.fromProvider === true)
    expect(providerFlights.length).toBeGreaterThanOrEqual(3)

    const reply = `${result.reply}\n${result.meta.spokenText || ''}`
    expect(reply).not.toMatch(/الخطة جاهزة|التكلفة الإجمالية المقدرة|هل ترغب في تأكيد الحجز/i)
    expect(reply).not.toMatch(/plan is ready|estimated total|confirm (the )?booking/i)
    expect(reply).not.toMatch(/Jordan|الأردن|Dubai|Morocco|المغرب|أنصح|أقترح|I suggest|I recommend|Perhaps|Let's first determine|خلنا نحدد أولاً/i)
    const questions = (reply.match(/[؟?]/g) || []).length
    expect(questions).toBeLessThanOrEqual(1)
  }, 60_000)
})
