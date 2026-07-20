import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { resetDefaultBookingProviderRegistry } from '../agent/bookingIntelligence'
import { resetDefaultBookingExecutionEngine, resetDefaultBookingSessionStore } from '../agent/bookingExecution'
import { resetDefaultPaymentSessionStore, resetDefaultPaymentsPlatformEngine, getDefaultPaymentsPlatformEngine } from '../agent/paymentsPlatform'
import { resetFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'

function msg(role: 'user' | 'assistant', content: string, cid: string, providerMeta: ChatMessage['providerMeta'] = {}): ChatMessage {
  return {
    id: role + Math.random().toString(36).slice(2), conversationId: cid, role, modality: 'text', content,
    audioUrl: null, imageUrl: null, attachments: [], status: 'complete', error: null, providerMeta,
    createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z',
  }
}

describe('Alpha Morocco conversational journey', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
    resetDefaultBookingSessionStore()
    resetDefaultBookingExecutionEngine()
    resetDefaultPaymentSessionStore()
    resetDefaultPaymentsPlatformEngine()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingProviderRegistry()
    resetDefaultBookingSessionStore()
    resetDefaultBookingExecutionEngine()
    resetDefaultPaymentSessionStore()
    resetDefaultPaymentsPlatformEngine()
  })

  it('plans Morocco prompt then books and pays', async () => {
    const cid = 'morocco-alpha'
    const service = createTravelAgentService({
      concierge: false, autonomousAgentEnabled: true,
      bookingIntelligenceEnabled: true, bookingExecutionEnabled: true, paymentsEnabled: true,
    })
    const t0 = 'أريد السفر إلى المغرب مع زوجتي لمدة سبعة أيام في سبتمبر بميزانية 12000 ريال'
    const plan = await service.planTurn({ conversationId: cid, messages: [msg('user', t0, cid)] })
    expect(plan.meta.bookingIntelligence?.bookingReady).toBe(true)
    expect(plan.meta.bookingIntelligence?.rankedCount).toBeGreaterThan(0)

    const history: ChatMessage[] = [
      msg('user', t0, cid),
      msg('assistant', plan.reply, cid, {
        kind: 'travel_agent', version: 2, memory: plan.meta.memory, tripPlan: plan.tripPlan,
        bookingIntelligence: plan.meta.bookingIntelligence,
      }),
    ]
    const booked = await service.planTurn({
      conversationId: cid,
      messages: [...history, msg('user', 'أكد الحجز الآن', cid)],
    })
    expect(booked.meta.bookingExecution?.confirmedCount).toBeGreaterThan(0)
    history.push(
      msg('user', 'أكد الحجز الآن', cid),
      msg('assistant', booked.reply, cid, {
        kind: 'travel_agent', version: 2, memory: booked.meta.memory, tripPlan: booked.tripPlan,
        bookingIntelligence: booked.meta.bookingIntelligence,
        bookingExecution: booked.meta.bookingExecution,
      }),
    )
    const paid = await service.planTurn({
      conversationId: cid,
      messages: [...history, msg('user', 'ادفع الآن ببطاقة مدى', cid)],
    })
    expect(['captured', 'partially_captured']).toContain(paid.meta.payments?.status)
    expect(paid.meta.payments!.documentCount).toBeGreaterThan(0)
    const docs = getDefaultPaymentsPlatformEngine().documents.list(paid.meta.payments!.paymentSessionId)
    expect(docs[0]!.downloadUrl.startsWith('data:text/plain')).toBe(true)
  }, 60_000)
})
