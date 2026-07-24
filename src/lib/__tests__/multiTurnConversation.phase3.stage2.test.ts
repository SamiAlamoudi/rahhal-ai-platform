/**
 * Phase 3 Stage 2 — Multi-Turn Conversation Manager tests.
 * New tests only — does not modify existing tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  MULTI_TURN_CONVERSATION_FEATURE_ID,
  MultiTurnManager,
  decideClarification,
  detectConversationTopic,
  enrichTurnWithMultiTurnManager,
  isMultiTurnConversationEnabled,
  loadMultiTurnSession,
  resetMultiTurnSessions,
  runMultiTurnManager,
  summarizeConversation,
  SUMMARY_TURN_THRESHOLD,
  trackConversationTurn,
  tryRunMultiTurnManager,
  createEmptyMultiTurnSession,
  saveMultiTurnSession,
} from '../agent/conversation'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'
import { emptyRequirements } from '../agent/types'

function user(content: string, conversationId = 'c-p3s2'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
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
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  }
}

describe('Phase 3 Stage 2 — Multi-Turn Conversation Manager', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMultiTurnSessions()
  })

  describe('feature gate', () => {
    it('registers ai.multi_turn_conversation default OFF', async () => {
      expect(getFeatureRegistry().isEnabled(MULTI_TURN_CONVERSATION_FEATURE_ID)).toBe(false)
      expect(isMultiTurnConversationEnabled()).toBe(false)
      expect(
        await tryRunMultiTurnManager({
          conversationId: 'c-off',
          userText: 'Plan a trip to Japan',
        }),
      ).toBeNull()
    })
  })

  describe('topic detection', () => {
    it('detects travel topics', () => {
      expect(detectConversationTopic('Plan a trip to Japan')).toBe('trip_planning')
      expect(detectConversationTopic('Where should I go for ideas?')).toBe(
        'destination_research',
      )
      expect(detectConversationTopic('Our budget is tight this year')).toBe(
        'budget_discussion',
      )
      expect(detectConversationTopic('Which hotel should we book?')).toBe('accommodation')
      expect(detectConversationTopic('What flights are available?')).toBe('transportation')
      expect(detectConversationTopic('Things to do in Kyoto')).toBe('activities')
      expect(detectConversationTopic('Do I need a visa for Japan?')).toBe('visa')
      expect(detectConversationTopic('How is the weather in April?')).toBe('weather')
      expect(detectConversationTopic('What do you recommend?')).toBe('recommendation')
    })
  })

  describe('turn tracking + corrections', () => {
    it('detects destination change as correction event', async () => {
      const first = await runMultiTurnManager({
        conversationId: 'c-track',
        userText: 'Plan a trip to Japan for 7 days',
        locale: 'en',
        enabled: true,
        productionReply: 'Japan sounds great.',
      })
      expect(first.session.destinationFacts.destination).toBe('Japan')

      const second = await runMultiTurnManager({
        conversationId: 'c-track',
        userText: 'Actually, make it Bali instead',
        locale: 'en',
        enabled: true,
        productionReply: 'Bali works.',
      })
      expect(second.event).toBe('changing_destination')
      expect(second.session.destinationFacts.destination).toBe('Bali')
      expect(second.session.userCorrections.length).toBeGreaterThan(0)
      expect(second.session.userCorrections.at(-1)?.nextValue).toBe('Bali')
    })

    it('tracks continuing discussion', async () => {
      await runMultiTurnManager({
        conversationId: 'c-cont',
        userText: 'Plan a family trip to Paris',
        locale: 'en',
        enabled: true,
        productionReply: 'Paris noted.',
      })
      const next = await runMultiTurnManager({
        conversationId: 'c-cont',
        userText: 'Also tell me more about museums',
        locale: 'en',
        enabled: true,
        productionReply: 'Museums are excellent.',
      })
      expect(['follow_up', 'switching_topics', 'continuing']).toContain(next.event)
      expect(next.turnNumber).toBeGreaterThan(1)
    })
  })

  describe('clarification discipline', () => {
    it('asks at most one clarification and never repeats answered ones', () => {
      let session = createEmptyMultiTurnSession('c-clarify', { locale: 'en' })
      const first = decideClarification({ session, locale: 'en' })
      expect(first.shouldClarify).toBe(true)
      expect(first.question).toBeTruthy()

      session = {
        ...session,
        answeredQuestions: [first.question!.toLowerCase()],
        resolvedClarifications: [first.question!.toLowerCase()],
        destinationFacts: { ...session.destinationFacts, destination: 'Japan' },
      }
      const second = decideClarification({ session, locale: 'en' })
      if (second.question) {
        expect(second.question.toLowerCase()).not.toBe(first.question!.toLowerCase())
      }
    })

    it('never interrupts when confidence is high', () => {
      const session = createEmptyMultiTurnSession('c-high', { locale: 'en' })
      session.destinationFacts.destination = 'Japan'
      session.strategyFacts.budgetAmount = 20000
      session.strategyFacts.durationDays = 7
      session.travelerFacts.adults = 2
      const decision = decideClarification({
        session,
        locale: 'en',
        confidenceHint: 0.9,
      })
      expect(decision.shouldClarify).toBe(false)
      expect(decision.reason).toBe('high_confidence')
    })
  })

  describe('summarization', () => {
    it('compresses long conversations into a summary', () => {
      let session = createEmptyMultiTurnSession('c-sum', { locale: 'en' })
      session.destinationFacts.destination = 'Japan'
      session.strategyFacts.budgetAmount = 15000
      session.strategyFacts.budgetCurrency = 'SAR'
      session.conversationTopic = 'trip_planning'
      for (let i = 0; i < SUMMARY_TURN_THRESHOLD; i += 1) {
        session.conversationHistory.push({
          turnNumber: i + 1,
          role: i % 2 === 0 ? 'user' : 'assistant',
          text: `turn-${i}`,
          topic: 'trip_planning',
          event: 'continuing',
          at: '2026-07-24T00:00:00.000Z',
        })
      }
      session.turnNumber = SUMMARY_TURN_THRESHOLD
      const result = summarizeConversation(session)
      expect(result.summarized).toBe(true)
      expect(result.summary.toLowerCase()).toContain('japan')
      expect(result.session.conversationHistory.length).toBeLessThan(
        SUMMARY_TURN_THRESHOLD,
      )
    })
  })

  describe('manager execution + recovery', () => {
    it('maintains session across turns and preserves facts', async () => {
      const a = await runMultiTurnManager({
        conversationId: 'c-mem',
        userText: 'Family trip to Japan, budget 20000 SAR, 10 days',
        locale: 'en',
        enabled: true,
        productionReply: 'Great — Japan for 10 days.',
      })
      expect(a.enabled).toBe(true)
      expect(a.session.destinationFacts.destination).toBe('Japan')
      expect(a.session.strategyFacts.budgetAmount).toBe(20000)
      expect(a.session.strategyFacts.durationDays).toBe(10)

      const b = await runMultiTurnManager({
        conversationId: 'c-mem',
        userText: 'continue',
        locale: 'en',
        enabled: true,
        productionReply: 'Continuing with Japan.',
      })
      expect(b.recovered || b.event === 'resuming' || b.event === 'continuing').toBe(true)
      expect(b.session.destinationFacts.destination).toBe('Japan')
      expect(b.session.strategyFacts.budgetAmount).toBe(20000)
      expect(b.tripGoal).toContain('Japan')
    })

    it('trackConversationTurn marks new trip', () => {
      const session = createEmptyMultiTurnSession('c-new', { locale: 'en' })
      session.destinationFacts.destination = 'Japan'
      session.turnNumber = 2
      const tracked = trackConversationTurn({
        userText: 'I want a new trip from scratch',
        topic: 'trip_planning',
        session,
      })
      expect(tracked.event).toBe('new_trip')
    })
  })

  describe('planTurn wiring', () => {
    it('does not attach multiTurnConversation while flag OFF', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p3s2-off',
        messages: [user('Honeymoon in Bali.')],
      })
      expect(turn.meta.multiTurnConversation).toBeUndefined()
    })

    it('attaches multi-turn meta when forced ON without mutating tripPlan', async () => {
      const service = createTravelAgentService({ multiTurnConversationEnabled: true })
      const turn = await service.planTurn({
        conversationId: 'c-p3s2-on',
        messages: [user(COMPLETE_JAPAN_7D, 'c-p3s2-on')],
      })
      expect(turn.meta.multiTurnConversation).toBeTruthy()
      expect(turn.meta.multiTurnConversation?.enabled).toBe(true)
      expect(turn.meta.multiTurnConversation?.turnNumber).toBeGreaterThan(0)
      expect(turn.tripPlan?.destinations.some((d) => /japan/i.test(d))).toBe(true)
      expect(turn.reply.length).toBeGreaterThan(0)

      const session = loadMultiTurnSession('c-p3s2-on')
      expect(session?.turnNumber).toBeGreaterThan(0)
    })

    it('enrichTurn is identity when disabled', async () => {
      const memory = {
        locale: 'en',
        phase: 'collecting' as const,
        requirements: { ...emptyRequirements(), destination: 'Japan' },
        tripPlan: null,
        itinerary: null,
        missingFields: [] as [],
        lastIntent: 'plan' as const,
      }
      const turn = {
        reply: 'KEEP',
        memory,
        tripPlan: null,
        meta: {
          kind: 'travel_agent' as const,
          version: 2 as const,
          memory,
          tripPlan: null,
          itinerary: null,
        },
        toolBatch: null,
      }
      const out = await enrichTurnWithMultiTurnManager(turn, {
        userText: 'Japan',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(out.reply).toBe('KEEP')
    })
  })

  describe('facade', () => {
    it('exposes MultiTurnManager helpers', () => {
      expect(MultiTurnManager.isEnabled()).toBe(false)
      expect(MultiTurnManager.featureId).toBe(MULTI_TURN_CONVERSATION_FEATURE_ID)
      const empty = createEmptyMultiTurnSession('c-facade', { locale: 'en' })
      saveMultiTurnSession(empty)
      expect(loadMultiTurnSession('c-facade')?.conversationId).toBe('c-facade')
    })
  })
})
