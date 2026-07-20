/**
 * Rahhal Alpha — end-to-end conversation journey.
 * Plan → recommend → book → pay → confirmation documents → second trip.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { resetDefaultBookingProviderRegistry } from '../agent/bookingIntelligence'
import {
  resetDefaultBookingExecutionEngine,
  resetDefaultBookingSessionStore,
} from '../agent/bookingExecution'
import {
  resetDefaultPaymentSessionStore,
  resetDefaultPaymentsPlatformEngine,
  getDefaultPaymentsPlatformEngine,
} from '../agent/paymentsPlatform'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_5D, COMPLETE_RIYADH_WEEKEND } from './agentTestFixtures'

function msg(
  role: 'user' | 'assistant',
  content: string,
  conversationId: string,
  providerMeta: ChatMessage['providerMeta'] = {},
): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  }
}

describe('Rahhal Alpha — full journey', () => {
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

  it('keeps Alpha product flags on', () => {
    const r = getFeatureRegistry()
    expect(r.isEnabled('ui.ai_home')).toBe(true)
    expect(r.isEnabled('ui.conversation_home')).toBe(true)
    expect(r.isEnabled('ai.booking_intelligence')).toBe(true)
    expect(r.isEnabled('ai.booking_execution')).toBe(true)
    expect(r.isEnabled('ai.payments')).toBe(true)
    expect(r.isEnabled('ai.ticketing')).toBe(true)
    expect(r.isEnabled('ai.live_providers')).toBe(false)
  })

  it('completes plan → book → pay → documents in one conversation, then starts another trip', async () => {
    const conversationId = 'alpha-journey-1'
    const service = createTravelAgentService({
      concierge: false,
      autonomousAgentEnabled: true,
      bookingIntelligenceEnabled: true,
      bookingExecutionEnabled: true,
      paymentsEnabled: true,
    })

    const plan = await service.planTurn({
      conversationId,
      messages: [msg('user', COMPLETE_JAPAN_5D, conversationId)],
    })
    expect(plan.reply.length).toBeGreaterThan(20)
    expect(plan.meta.bookingIntelligence?.bookingReady).toBe(true)
    expect(plan.meta.bookingIntelligence?.rankedCount).toBeGreaterThan(0)
    expect(plan.reply).not.toMatch(/ai\.|feature flag|JSON|sprint\s*\d+/i)

    const history: ChatMessage[] = [
      msg('user', COMPLETE_JAPAN_5D, conversationId),
      msg('assistant', plan.reply, conversationId, {
        kind: 'travel_agent',
        version: 2,
        memory: plan.meta.memory,
        tripPlan: plan.tripPlan ?? plan.meta.tripPlan,
        bookingIntelligence: plan.meta.bookingIntelligence,
      }),
    ]

    const booked = await service.planTurn({
      conversationId,
      messages: [...history, msg('user', 'أكد الحجز الآن', conversationId)],
    })
    expect(booked.meta.bookingExecution).toBeTruthy()
    expect(booked.meta.bookingExecution!.confirmedCount).toBeGreaterThan(0)
    history.push(
      msg('user', 'أكد الحجز الآن', conversationId),
      msg('assistant', booked.reply, conversationId, {
        kind: 'travel_agent',
        version: 2,
        memory: booked.meta.memory,
        tripPlan: booked.tripPlan ?? booked.meta.tripPlan,
        bookingIntelligence: booked.meta.bookingIntelligence,
        bookingExecution: booked.meta.bookingExecution,
      }),
    )

    const paid = await service.planTurn({
      conversationId,
      messages: [...history, msg('user', 'ادفع الآن ببطاقة مدى', conversationId)],
    })
    expect(paid.meta.payments).toBeTruthy()
    expect(['captured', 'partially_captured']).toContain(paid.meta.payments!.status)
    expect(paid.meta.payments!.ticketCount).toBeGreaterThan(0)
    expect(paid.meta.payments!.documentCount).toBeGreaterThan(0)

    const docs = getDefaultPaymentsPlatformEngine().documents.list(
      paid.meta.payments!.paymentSessionId,
    )
    expect(docs.length).toBeGreaterThan(0)
    expect(docs[0]!.downloadUrl.startsWith('data:text/plain')).toBe(true)

    history.push(
      msg('user', 'ادفع الآن ببطاقة مدى', conversationId),
      msg('assistant', paid.reply, conversationId, {
        kind: 'travel_agent',
        version: 2,
        memory: paid.meta.memory,
        tripPlan: paid.tripPlan ?? paid.meta.tripPlan,
        payments: paid.meta.payments,
        bookingExecution: paid.meta.bookingExecution,
      }),
    )

    const summary = await service.planTurn({
      conversationId,
      messages: [...history, msg('user', 'أعرض ملخص التأكيد والمستندات', conversationId)],
    })
    expect(summary.meta.payments?.paymentSessionId).toBe(paid.meta.payments!.paymentSessionId)
    expect(summary.meta.payments!.documentCount).toBeGreaterThan(0)

    const second = await service.planTurn({
      conversationId: 'alpha-journey-2',
      messages: [msg('user', COMPLETE_RIYADH_WEEKEND, 'alpha-journey-2')],
    })
    expect(second.tripPlan?.destinations?.length || second.meta.bookingIntelligence).toBeTruthy()
    expect(second.reply.length).toBeGreaterThan(10)
  }, 60_000)
})
