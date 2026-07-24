/**
 * Phase 3 Stage 1 — Conversation Orchestrator tests.
 * New tests only — does not modify existing tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  ConversationOrchestrator,
  buildConversationReply,
  detectConversationIntent,
  enrichTurnWithConversationOrchestrator,
  extractKnownFactsFromText,
  isConversationOrchestratorEnabled,
  mergeKnownFacts,
  planConversationStages,
  resetConversationMemory,
  runConversationOrchestrator,
  tryRunConversationOrchestrator,
  createEmptyConversationState,
  wasQuestionAsked,
  markQuestionAnswered,
  setPendingClarification,
} from '../agent/conversation'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'
import { emptyRequirements } from '../agent/types'

function user(content: string, conversationId = 'c-p3s1'): ChatMessage {
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

describe('Phase 3 Stage 1 — Conversation Orchestrator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConversationMemory()
  })

  describe('feature gate', () => {
    it('registers ai.conversation_orchestrator default OFF', async () => {
      expect(getFeatureRegistry().isEnabled(CONVERSATION_ORCHESTRATOR_FEATURE_ID)).toBe(false)
      expect(isConversationOrchestratorEnabled()).toBe(false)
      expect(
        await tryRunConversationOrchestrator({
          conversationId: 'c-off',
          userText: 'Plan a trip to Japan',
        }),
      ).toBeNull()
    })
  })

  describe('intent detection', () => {
    it('detects core intents', () => {
      expect(detectConversationIntent('Where should I go for vacation ideas?')).toBe(
        'destination_discovery',
      )
      expect(detectConversationIntent('Plan a trip to Japan for 7 days')).toBe('trip_planning')
      expect(detectConversationIntent('What do you recommend for us?')).toBe('recommendation')
      expect(detectConversationIntent('Help me optimize my budget for this trip')).toBe(
        'budget_optimization',
      )
      expect(detectConversationIntent('Can you refine day 3 of the itinerary?')).toBe(
        'itinerary_refinement',
      )
      expect(detectConversationIntent('Compare Japan versus Bali')).toBe('compare_destinations')
      expect(detectConversationIntent('Any visa tips for Japan?')).toBe('general_travel_advice')
    })

    it('treats pending clarification replies as clarification_reply', () => {
      expect(
        detectConversationIntent('About 15000 SAR', {
          pendingClarification: 'What is your approximate trip budget?',
        }),
      ).toBe('clarification_reply')
    })

    it('continues previous conversation on short continue cues', () => {
      expect(
        detectConversationIntent('continue', { lastIntent: 'trip_planning' }),
      ).toBe('continue_previous')
    })
  })

  describe('stage planning', () => {
    it('selects intent stages and never drops unified response from maps that include it', () => {
      const state = createEmptyConversationState('c1', 'en')
      const stages = planConversationStages('recommendation', state)
      expect(stages).toContain('recommendation_intelligence')
      expect(stages).toContain('unified_consultant_response')
      expect(stages).not.toContain('travel_strategy')
    })

    it('keeps clarification path light when destination already known', () => {
      const state = createEmptyConversationState('c1', 'en')
      state.knownFacts.destination = 'Japan'
      const stages = planConversationStages('clarification_reply', state)
      expect(stages).toContain('traveler_intelligence')
      expect(stages).not.toContain('destination_intelligence')
    })
  })

  describe('memory policy', () => {
    it('appends facts and lets user corrections win', () => {
      const base = mergeKnownFacts({}, { destination: 'Japan', budgetAmount: 10000 })
      const corrected = mergeKnownFacts(base, { destination: 'Bali', budgetAmount: 8000 })
      expect(corrected.destination).toBe('Bali')
      expect(corrected.budgetAmount).toBe(8000)
      expect(extractKnownFactsFromText('Family trip to Paris for 5 days').destination).toBe(
        'Paris',
      )
    })

    it('never re-asks a previously asked clarification', () => {
      let state = createEmptyConversationState('c-ask', 'en')
      const q = 'Which destination are you considering?'
      state = setPendingClarification(state, q)
      state = markQuestionAnswered(state, q)
      expect(wasQuestionAsked(state, q)).toBe(true)

      const reply = buildConversationReply({
        locale: 'en',
        format: 'consultant',
        confidence: 0.2,
        consultantResponse: {
          body: {
            executiveSummary: [],
            travelerUnderstanding: [],
            destinationUnderstanding: [],
            recommendedStrategy: [],
            primaryRecommendation: [],
            alternativeRecommendation: [],
            tradeoffs: [],
            risks: [],
            missingInformation: ['destination'],
            clarificationQuestions: [q],
            confidenceScore: 0.2,
          },
          formats: {},
        },
        state,
        userText: 'hello',
      })
      expect(reply.clarificationQuestion).not.toBe(q)
      expect(reply.clarificationQuestion).toBeTruthy()
    })
  })

  describe('confidence reply rules', () => {
    const state = createEmptyConversationState('c-reply', 'en')
    state.knownFacts.destination = 'Japan'

    const consultantResponse = {
      body: {
        executiveSummary: ['Japan fits a calm cultural week.'],
        travelerUnderstanding: ['You want a relaxed pace.'],
        destinationUnderstanding: ['Japan offers culture and food.'],
        recommendedStrategy: ['Focus on Tokyo and Kyoto.'],
        primaryRecommendation: ['Tokyo + Kyoto in 7 days.'],
        alternativeRecommendation: ['Add Osaka if energy allows.'],
        tradeoffs: ['More cities means more transit.'],
        risks: ['Peak season crowds.'],
        missingInformation: [] as string[],
        clarificationQuestions: [] as string[],
        confidenceScore: 0.85,
      },
      formats: {
        executive: { oneLiner: 'Japan is a strong fit.' },
        short: { title: 'Japan week', why: 'Culture + food' },
        consultant: { voice: ['Japan looks like a strong fit for your brief.'] },
      },
    }

    it('high confidence answers immediately without a clarification', () => {
      const reply = buildConversationReply({
        locale: 'en',
        format: 'consultant',
        confidence: 0.85,
        consultantResponse,
        state,
        userText: 'Plan Japan',
      })
      expect(reply.confidenceBand).toBe('high')
      expect(reply.clarificationQuestion).toBeNull()
      expect(reply.reply.toLowerCase()).toContain('japan')
      expect(reply.reply).not.toMatch(/\?/)
    })

    it('medium confidence answers first then one optional follow-up', () => {
      const reply = buildConversationReply({
        locale: 'en',
        format: 'short',
        confidence: 0.5,
        consultantResponse: {
          ...consultantResponse,
          body: {
            ...consultantResponse.body,
            confidenceScore: 0.5,
            missingInformation: ['budget'],
            clarificationQuestions: ['What is your approximate trip budget?'],
          },
        },
        state,
        userText: 'Japan ideas',
      })
      expect(reply.confidenceBand).toBe('medium')
      expect(reply.reply).toMatch(/optional follow-up/i)
      expect(reply.clarificationQuestion).toBe('What is your approximate trip budget?')
      expect((reply.reply.match(/\?/g) ?? []).length).toBe(1)
    })

    it('low confidence asks exactly one clarification and does not invent facts', () => {
      const emptyState = createEmptyConversationState('c-low', 'en')
      const reply = buildConversationReply({
        locale: 'en',
        format: 'consultant',
        confidence: 0.15,
        consultantResponse: {
          body: {
            ...consultantResponse.body,
            executiveSummary: [],
            primaryRecommendation: [],
            recommendedStrategy: [],
            confidenceScore: 0.15,
            missingInformation: ['destination'],
            clarificationQuestions: ['Which destination are you considering?'],
          },
          formats: {},
        },
        state: emptyState,
        userText: 'help',
      })
      expect(reply.confidenceBand).toBe('low')
      expect(reply.clarificationQuestion).toBe('Which destination are you considering?')
      expect(reply.reply).toBe(reply.clarificationQuestion)
      expect(reply.reply.toLowerCase()).not.toContain('tokyo + kyoto')
    })
  })

  describe('orchestrator execution', () => {
    it('runs planned stages via Runtime Coordinator and returns a reply', async () => {
      const result = await runConversationOrchestrator({
        conversationId: 'c-run',
        userText: 'Plan a family trip to Japan for 10 days, budget 20000 SAR',
        locale: 'en',
        format: 'consultant',
        enabled: true,
        known: {
          destination: 'Japan',
          budgetAmount: 20000,
          budgetCurrency: 'SAR',
          durationDays: 10,
          adults: 2,
          tripPurpose: 'family',
        },
      })
      expect(result.enabled).toBe(true)
      expect(result.intent).toBe('trip_planning')
      expect(result.stagesRequested.length).toBeGreaterThan(0)
      expect(result.stagesRequested).toContain('unified_consultant_response')
      expect(result.reply.length).toBeGreaterThan(0)
      expect(result.runtime).toBeTruthy()
      expect(result.state.turnNumber).toBeGreaterThan(0)
      expect(result.state.knownFacts.destination).toBe('Japan')
    })

    it('skips unnecessary stages for general advice', async () => {
      const result = await runConversationOrchestrator({
        conversationId: 'c-advice',
        userText: 'Any visa tips for Japan?',
        locale: 'en',
        enabled: true,
        known: { destination: 'Japan' },
      })
      expect(result.intent).toBe('general_travel_advice')
      expect(result.stagesRequested).not.toContain('travel_strategy')
      expect(result.stagesRequested).not.toContain('planning_graph')
      expect(result.stagesRequested).toContain('unified_consultant_response')
    })
  })

  describe('planTurn wiring', () => {
    it('does not attach conversationOrchestrator while flag OFF', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-p3-off',
        messages: [user('Honeymoon in Bali.')],
      })
      expect(turn.meta.conversationOrchestrator).toBeUndefined()
      expect(turn.meta.runtimeCoordinator).toBeUndefined()
    })

    it('attaches conversation meta when forced ON without mutating tripPlan', async () => {
      const service = createTravelAgentService({ conversationOrchestratorEnabled: true })
      const turn = await service.planTurn({
        conversationId: 'c-p3-on',
        messages: [user(COMPLETE_JAPAN_7D, 'c-p3-on')],
      })
      expect(turn.meta.conversationOrchestrator).toBeTruthy()
      expect(turn.meta.conversationOrchestrator?.enabled).toBe(true)
      expect(turn.meta.conversationOrchestrator?.intent).toBeTruthy()
      expect(turn.meta.runtimeCoordinator).toBeTruthy()
      expect(turn.tripPlan?.destinations.some((d) => /japan/i.test(d))).toBe(true)
      expect(turn.reply.length).toBeGreaterThan(0)
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
      const out = await enrichTurnWithConversationOrchestrator(turn, {
        userText: 'Japan',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(out.reply).toBe('KEEP')
    })
  })

  describe('ConversationOrchestrator facade', () => {
    it('exposes run / tryRun / isEnabled', () => {
      expect(ConversationOrchestrator.isEnabled()).toBe(false)
      expect(ConversationOrchestrator.featureId).toBe(CONVERSATION_ORCHESTRATOR_FEATURE_ID)
    })
  })
})
