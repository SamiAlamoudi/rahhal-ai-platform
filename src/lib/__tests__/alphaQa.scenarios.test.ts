/**
 * Alpha QA — traveler scenarios through plan → book → pay.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { resetDefaultBookingProviderRegistry } from '../agent/bookingIntelligence'
import {
  resetDefaultBookingExecutionEngine,
  resetDefaultBookingSessionStore,
} from '../agent/bookingExecution'
import {
  getDefaultPaymentsPlatformEngine,
  resetDefaultPaymentSessionStore,
  resetDefaultPaymentsPlatformEngine,
} from '../agent/paymentsPlatform'
import { resetFeatureRegistry } from '../ai'
import type { ChatMessage } from '../chat/chatTypes'

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

async function completeJourney(prompt: string, followUps: string[] = []) {
  const conversationId = `qa-${Math.random().toString(36).slice(2, 8)}`
  const service = createTravelAgentService({
    concierge: false,
    autonomousAgentEnabled: true,
    bookingIntelligenceEnabled: true,
    bookingExecutionEnabled: true,
    paymentsEnabled: true,
  })

  const history: ChatMessage[] = [msg('user', prompt, conversationId)]
  let turn = await service.planTurn({ conversationId, messages: history })
  history.push(msg('assistant', turn.reply, conversationId, {
    kind: 'travel_agent',
    version: 2,
    memory: turn.meta.memory,
    tripPlan: turn.tripPlan,
    bookingIntelligence: turn.meta.bookingIntelligence,
  }))

  for (const followUp of followUps) {
    history.push(msg('user', followUp, conversationId))
    turn = await service.planTurn({ conversationId, messages: history })
    history.push(msg('assistant', turn.reply, conversationId, {
      kind: 'travel_agent',
      version: 2,
      memory: turn.meta.memory,
      tripPlan: turn.tripPlan,
      bookingIntelligence: turn.meta.bookingIntelligence,
    }))
  }

  expect(turn.meta.bookingIntelligence?.bookingReady).toBe(true)
  expect(turn.reply.length).toBeGreaterThan(20)
  expect(turn.reply).not.toMatch(/\bai\.(payments|booking)|feature flag|sprint\s*\d+/i)

  history.push(msg('user', 'أكد الحجز الآن', conversationId))
  const booked = await service.planTurn({ conversationId, messages: history })
  expect(booked.meta.bookingExecution?.confirmedCount).toBeGreaterThan(0)
  history.push(
    msg('user', 'أكد الحجز الآن', conversationId),
    msg('assistant', booked.reply, conversationId, {
      kind: 'travel_agent',
      version: 2,
      memory: booked.meta.memory,
      tripPlan: booked.tripPlan,
      bookingIntelligence: booked.meta.bookingIntelligence,
      bookingExecution: booked.meta.bookingExecution,
    }),
  )

  history.push(msg('user', 'ادفع الآن', conversationId))
  const paid = await service.planTurn({ conversationId, messages: history })
  expect(['captured', 'partially_captured']).toContain(paid.meta.payments?.status)
  expect(paid.meta.payments!.documentCount).toBeGreaterThan(0)
  const docs = getDefaultPaymentsPlatformEngine().documents.list(
    paid.meta.payments!.paymentSessionId,
  )
  expect(docs.length).toBeGreaterThan(0)
  expect(docs[0]!.downloadUrl.startsWith('data:text/plain')).toBe(true)

  return {
    destination: turn.meta.memory?.requirements?.destination,
    destinations: turn.meta.memory?.requirements?.destinations,
    travelers: turn.meta.memory?.requirements?.travelers,
    documentCount: paid.meta.payments!.documentCount,
  }
}

describe('Alpha QA — traveler scenarios', () => {
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

  it('1 solo traveler', async () => {
    const result = await completeJourney(
      'I want a solo trip to Tokyo for 5 days in October, budget 8000 SAR from Riyadh',
    )
    expect(result.destination).toBe('Tokyo')
    expect(result.travelers).toBe(1)
  }, 60_000)

  it('2 family trip', async () => {
    const result = await completeJourney(
      'Family trip to Dubai with 2 kids, 6 days, budget 15000 SAR from Riyadh',
    )
    expect(result.destination).toBe('Dubai')
    expect(result.travelers).toBe(4)
  }, 60_000)

  it('3 business trip', async () => {
    const result = await completeJourney(
      'Business trip to London for 3 days next month from Jeddah, budget 12000 SAR',
    )
    expect(result.destination).toBe('London')
  }, 60_000)

  it('4 multi-city trip', async () => {
    const result = await completeJourney(
      'I want to visit Paris and Rome in one trip for 10 days, 2 travelers, budget 20000 SAR from Riyadh',
    )
    expect(result.destinations).toEqual(expect.arrayContaining(['Paris', 'Rome']))
  }, 60_000)

  it('5 luxury trip', async () => {
    const result = await completeJourney(
      'Luxury honeymoon in Maldives, 7 days, budget 40000 SAR from Riyadh',
    )
    expect(result.destination).toBe('Maldives')
    expect(result.travelers).toBe(2)
  }, 60_000)

  it('6 budget trip', async () => {
    const result = await completeJourney(
      'Cheap trip to Cairo for one person, 4 days, under 3000 SAR from Riyadh',
    )
    expect(result.destination).toBe('Cairo')
    expect(result.travelers).toBe(1)
  }, 60_000)

  it('7 Arabic conversation', async () => {
    const result = await completeJourney(
      'أريد رحلة عائلية إلى إسطنبول لمدة 6 أيام بميزانية 10000 ريال من جدة مع 2 أطفال',
    )
    expect(result.destination).toBe('Istanbul')
    expect(result.travelers).toBe(4)
  }, 60_000)

  it('8 English conversation', async () => {
    const result = await completeJourney(
      'Plan a weekend in Barcelona for a couple under 5000 EUR from London',
    )
    expect(result.destination).toBe('Barcelona')
    expect(result.travelers).toBe(2)
  }, 60_000)
})
