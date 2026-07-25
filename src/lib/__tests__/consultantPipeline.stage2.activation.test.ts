/**
 * Phase 2 Stage 2 — Consultant Pipeline activation tests.
 * New tests only — does not modify existing planTurn tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  CONSULTANT_PIPELINE_FEATURE_ID,
  enrichTurnWithConsultantPipeline,
  getConsultantPipelineTelemetry,
  isConsultantPipelineEnabled,
  resetConsultantPipelineTelemetry,
} from '../agent/orchestrator'
import type { AgentMemory, AgentProviderMeta } from '../agent/types'
import { emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D, COMPLETE_LONDON_BUSINESS } from './agentTestFixtures'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'c-stage2',
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

function baseTurn(partial?: {
  reply?: string
  destination?: string | null
}): {
  reply: string
  memory: AgentMemory
  tripPlan: null
  meta: AgentProviderMeta
  toolBatch: null
} {
  const requirements = {
    ...emptyRequirements(),
    destination: partial?.destination ?? 'Japan',
    destinations: partial?.destination ? [partial.destination] : ['Japan'],
    durationDays: 7,
    budgetAmount: 20000,
    budgetCurrency: 'SAR',
    travelers: 2,
    tripPurpose: 'family' as const,
  }
  const memory: AgentMemory = {
    locale: 'en',
    phase: 'collecting',
    requirements,
    tripPlan: null,
    itinerary: null,
    missingFields: [],
    lastIntent: 'plan',
  }
  return {
    reply: partial?.reply ?? 'Production reply unchanged',
    memory,
    tripPlan: null,
    meta: {
      kind: 'travel_agent',
      version: 2,
      memory,
      tripPlan: null,
      itinerary: null,
    },
    toolBatch: null,
  }
}

describe('Phase 2 Stage 2 — Consultant Pipeline Activation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetConsultantPipelineTelemetry()
  })

  describe('flag OFF — production identity', () => {
    it('keeps ai.consultant_pipeline default OFF', () => {
      expect(getFeatureRegistry().isEnabled(CONSULTANT_PIPELINE_FEATURE_ID)).toBe(false)
      expect(isConsultantPipelineEnabled()).toBe(false)
    })

    it('enrichTurn is a no-op when disabled (same object)', async () => {
      const turn = baseTurn()
      const out = await enrichTurnWithConsultantPipeline(turn, {
        userText: 'Japan trip',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(out.meta.consultantPipeline).toBeUndefined()
      expect(getConsultantPipelineTelemetry().runCount).toBe(0)
    })

    it('planTurn without override matches production shape (no consultantPipeline meta)', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-stage2-off',
        messages: [user('Honeymoon in Bali.')],
      })
      expect(turn.meta.consultantPipeline).toBeUndefined()
      expect(turn.memory.missingFields).toContain('durationDays')
      expect(turn.tripPlan).toBeNull()
    })
  })

  describe('flag ON — read-only enrichment', () => {
    it('attaches consultantPipeline meta without mutating reply/plan', async () => {
      const turn = baseTurn({ reply: 'KEEP_REPLY' })
      const planRef = turn.tripPlan
      const memoryRef = turn.memory
      const reply = turn.reply

      const out = await enrichTurnWithConsultantPipeline(turn, {
        userText: 'Family trip to Japan for 7 days, budget 20000 SAR',
        conversationId: 'c1',
        enabled: true,
      })

      expect(out.reply).toBe(reply)
      expect(out.tripPlan).toBe(planRef)
      expect(out.memory).toBe(memoryRef)
      expect(out.meta.consultantPipeline).toBeTruthy()
      expect(out.meta.consultantPipeline?.enabled).toBe(true)
      expect(out.meta.consultantPipeline?.travelerUnderstanding.length).toBeGreaterThan(0)
      expect(out.meta.consultantPipeline?.destinationUnderstanding.length).toBeGreaterThan(0)
      expect(out.meta.consultantPipeline?.travelStrategy.length).toBeGreaterThan(0)
      expect(Array.isArray(out.meta.consultantPipeline?.recommendationSummary)).toBe(true)
      expect(Array.isArray(out.meta.consultantPipeline?.alternative)).toBe(true)
      expect(Array.isArray(out.meta.consultantPipeline?.tradeoffs)).toBe(true)
      expect(Array.isArray(out.meta.consultantPipeline?.risks)).toBe(true)
      expect(typeof out.meta.consultantPipeline?.confidence).toBe('number')
      expect(Array.isArray(out.meta.consultantPipeline?.missingInformation)).toBe(true)
      expect(Array.isArray(out.meta.consultantPipeline?.clarificationQuestions)).toBe(true)
      expect(out.meta.consultantPipeline?.telemetry.success).toBe(true)
      expect(out.meta.consultantPipeline?.telemetry.stageCount).toBeGreaterThan(0)
    })

    it('records telemetry without personal data fields', async () => {
      await enrichTurnWithConsultantPipeline(baseTurn(), {
        userText: 'SECRET_USER_PII_SHOULD_NOT_BE_LOGGED',
        conversationId: 'user-email@example.com',
        enabled: true,
      })
      const snap = getConsultantPipelineTelemetry()
      expect(snap.runCount).toBe(1)
      expect(snap.successCount).toBe(1)
      expect(snap.last?.success).toBe(true)
      const serialized = JSON.stringify(snap)
      expect(serialized).not.toContain('SECRET_USER_PII')
      expect(serialized).not.toContain('user-email@example.com')
    })

    it('planTurn with consultantPipelineEnabled attaches meta and keeps plan destinations', async () => {
      const service = createTravelAgentService({ consultantPipelineEnabled: true })
      const turn = await service.planTurn({
        conversationId: 'c-stage2-on',
        messages: [user(COMPLETE_JAPAN_7D)],
      })
      expect(turn.meta.consultantPipeline).toBeTruthy()
      expect(turn.tripPlan?.destinations.some((d) => /japan/i.test(d))).toBe(true)
      // Production reply still authored by Conversation Brain path
      expect(turn.reply.length).toBeGreaterThan(0)
      // Pipeline must not wipe itinerary
      if (turn.tripPlan) {
        expect(turn.meta.tripPlan).toBe(turn.tripPlan)
        expect(turn.meta.itinerary).toBe(turn.tripPlan)
      }
    })

    it('explicit consultantPipelineEnabled:false forces OFF even if caller might enable later', async () => {
      const service = createTravelAgentService({ consultantPipelineEnabled: false })
      const turn = await service.planTurn({
        conversationId: 'c-stage2-force-off',
        messages: [user(COMPLETE_LONDON_BUSINESS)],
      })
      expect(turn.meta.consultantPipeline).toBeUndefined()
      expect(turn.tripPlan?.destinations).toContain('London')
    })
  })

  describe('safety — never mutate production planning', () => {
    it('does not change tripPlan object identity when enriching', async () => {
      const service = createTravelAgentService()
      const planned = await service.planTurn({
        conversationId: 'c-stage2-safety',
        messages: [user(COMPLETE_LONDON_BUSINESS)],
      })
      expect(planned.tripPlan).toBeTruthy()
      const frozenPlan = planned.tripPlan
      const frozenReply = planned.reply
      const destinations = [...(frozenPlan?.destinations ?? [])]

      const enriched = await enrichTurnWithConsultantPipeline(
        {
          reply: planned.reply,
          memory: planned.memory,
          tripPlan: planned.tripPlan,
          meta: planned.meta,
          toolBatch: planned.toolBatch,
        },
        {
          userText: COMPLETE_LONDON_BUSINESS,
          conversationId: 'c-stage2-safety',
          enabled: true,
        },
      )

      expect(enriched.tripPlan).toBe(frozenPlan)
      expect(enriched.reply).toBe(frozenReply)
      expect(enriched.tripPlan?.destinations).toEqual(destinations)
      expect(enriched.meta.consultantPipeline).toBeTruthy()
    })
  })
})
