/**
 * Phase 2 Stage 4 — AI Runtime Coordinator tests.
 * New tests only — does not modify existing tests.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  RUNTIME_COORDINATOR_FEATURE_ID,
  RuntimeCache,
  dependentsOf,
  enrichTurnWithRuntimeCoordinator,
  getRuntimeCoordinatorTelemetry,
  isRuntimeCoordinatorEnabled,
  resetRuntimeCoordinatorTelemetry,
  resetSharedRuntimeCache,
  resolveRuntimeExecutionOrder,
  runRuntimeCoordinator,
  tryRunRuntimeCoordinator,
} from '../agent/orchestrator'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_7D } from './agentTestFixtures'
import { emptyRequirements } from '../agent/types'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'c-stage4',
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

const baseInput = {
  locale: 'en' as const,
  userText: 'Family trip to Japan for 10 days, budget 20000 SAR',
  conversationId: 'c-runtime',
  sessionId: 'session-runtime',
  known: {
    destination: 'Japan',
    budgetAmount: 20000,
    budgetCurrency: 'SAR',
    durationDays: 10,
    adults: 2,
    monthHint: 4,
    tripPurpose: 'family',
  },
  enabled: true as const,
}

describe('Phase 2 Stage 4 — AI Runtime Coordinator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetRuntimeCoordinatorTelemetry()
    resetSharedRuntimeCache()
  })

  describe('feature gate', () => {
    it('registers ai.runtime_coordinator default OFF', async () => {
      expect(getFeatureRegistry().isEnabled(RUNTIME_COORDINATOR_FEATURE_ID)).toBe(false)
      expect(isRuntimeCoordinatorEnabled()).toBe(false)
      expect(await tryRunRuntimeCoordinator({ ...baseInput, enabled: undefined })).toBeNull()
    })
  })

  describe('dependency resolution + execution order', () => {
    it('resolves prerequisites for recommendation + strategy', () => {
      const order = resolveRuntimeExecutionOrder([
        'recommendation_intelligence',
        'travel_strategy',
        'unified_consultant_response',
      ])
      expect(order.indexOf('traveler_intelligence')).toBeLessThan(
        order.indexOf('destination_intelligence'),
      )
      expect(order.indexOf('destination_intelligence')).toBeLessThan(
        order.indexOf('recommendation_intelligence'),
      )
      expect(order.indexOf('planning_graph')).toBeLessThan(
        order.indexOf('recommendation_intelligence'),
      )
      expect(order.at(-1)).toBe('unified_consultant_response')
    })

    it('lists transitive dependents for isolation', () => {
      const deps = dependentsOf('traveler_intelligence')
      expect(deps).toEqual(
        expect.arrayContaining([
          'planning_graph',
          'destination_intelligence',
          'recommendation_intelligence',
          'travel_strategy',
          'unified_consultant_response',
        ]),
      )
    })
  })

  describe('coordinator execution', () => {
    it('runs mission stages and produces unified response', async () => {
      const result = await runRuntimeCoordinator(baseInput)
      expect(result.enabled).toBe(true)
      expect(result.executionOrder.length).toBeGreaterThan(0)
      expect(result.stages.some((s) => s.stageId === 'traveler_intelligence')).toBe(true)
      expect(result.stages.some((s) => s.stageId === 'destination_intelligence')).toBe(true)
      expect(result.stages.some((s) => s.stageId === 'travel_strategy')).toBe(true)
      expect(result.stages.some((s) => s.stageId === 'recommendation_intelligence')).toBe(true)
      expect(result.stages.some((s) => s.stageId === 'reflection')).toBe(true)
      expect(result.stages.some((s) => s.stageId === 'planning_graph')).toBe(true)
      expect(result.stages.some((s) => s.stageId === 'unified_consultant_response')).toBe(true)
      expect(result.consultantResponse).toBeTruthy()
      expect(result.telemetry.totalDurationMs).toBeGreaterThanOrEqual(0)
      expect(result.telemetry.executionOrder).toEqual(result.executionOrder)
    })

    it('skips unnecessary engines when a subset is requested', async () => {
      const result = await runRuntimeCoordinator({
        ...baseInput,
        stages: ['traveler_intelligence', 'destination_intelligence'],
      })
      const ids = result.stages.map((s) => s.stageId)
      expect(ids).toContain('traveler_intelligence')
      expect(ids).toContain('destination_intelligence')
      expect(ids).not.toContain('unified_consultant_response')
      expect(ids).not.toContain('travel_strategy')
    })
  })

  describe('runtime cache', () => {
    it('reuses immutable results on second run (cache hits)', async () => {
      const cache = new RuntimeCache()
      const first = await runRuntimeCoordinator(baseInput, { cache })
      const missesAfterFirst = first.telemetry.cacheMisses
      expect(missesAfterFirst).toBeGreaterThan(0)

      const second = await runRuntimeCoordinator(baseInput, { cache })
      expect(second.telemetry.cacheHits).toBeGreaterThan(0)
      expect(second.stages.every((s) => s.status === 'cached' || s.status === 'skipped')).toBe(true)
    })

    it('hashes context stably', () => {
      const a = RuntimeCache.hashContext({ destination: 'Japan', n: 1 })
      const b = RuntimeCache.hashContext({ n: 1, destination: 'Japan' })
      expect(a).toBe(b)
      expect(RuntimeCache.hashContext({ destination: 'Paris' })).not.toBe(a)
    })
  })

  describe('failure isolation', () => {
    it('skips dependents when a prerequisite fails', async () => {
      const result = await runRuntimeCoordinator({
        ...baseInput,
        faultInject: { traveler_intelligence: 'throw' },
      })
      const traveler = result.stages.find((s) => s.stageId === 'traveler_intelligence')
      expect(traveler?.status).toBe('failed')
      const dest = result.stages.find((s) => s.stageId === 'destination_intelligence')
      expect(dest?.status).toBe('skipped')
      const strategy = result.stages.find((s) => s.stageId === 'travel_strategy')
      expect(strategy?.status).toBe('skipped')
      // Reflection has no traveler dependency — may still complete
      const reflection = result.stages.find((s) => s.stageId === 'reflection')
      expect(reflection?.status === 'completed' || reflection?.status === 'cached').toBe(true)
      expect(result.telemetry.failures).toBeGreaterThan(0)
    })
  })

  describe('timeout handling', () => {
    it('isolates timeout faults without crashing the coordinator', async () => {
      const result = await runRuntimeCoordinator({
        ...baseInput,
        faultInject: { destination_intelligence: 'timeout' },
      })
      const dest = result.stages.find((s) => s.stageId === 'destination_intelligence')
      expect(dest?.status).toBe('timeout')
      expect(result.telemetry.timeouts).toBeGreaterThan(0)
      const rec = result.stages.find((s) => s.stageId === 'recommendation_intelligence')
      expect(rec?.status).toBe('skipped')
    })

    it('honors AbortSignal cancellation', async () => {
      const controller = new AbortController()
      controller.abort()
      const result = await runRuntimeCoordinator({
        ...baseInput,
        signal: controller.signal,
      })
      expect(result.cancelled).toBe(true)
      expect(result.stages.some((s) => s.status === 'cancelled')).toBe(true)
    })
  })

  describe('planTurn wiring', () => {
    it('does not attach runtimeCoordinator while flag OFF', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-stage4-off',
        messages: [user('Honeymoon in Bali.')],
      })
      expect(turn.meta.runtimeCoordinator).toBeUndefined()
    })

    it('attaches runtimeCoordinator meta when forced ON without mutating plan', async () => {
      const service = createTravelAgentService({ runtimeCoordinatorEnabled: true })
      const turn = await service.planTurn({
        conversationId: 'c-stage4-on',
        messages: [user(COMPLETE_JAPAN_7D)],
      })
      expect(turn.meta.runtimeCoordinator).toBeTruthy()
      expect(turn.meta.runtimeCoordinator?.enabled).toBe(true)
      expect(turn.meta.runtimeCoordinator?.executionOrder.length).toBeGreaterThan(0)
      expect(turn.meta.consultantResponse).toBeTruthy()
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
      const out = await enrichTurnWithRuntimeCoordinator(turn, {
        userText: 'Japan',
        conversationId: 'c1',
        enabled: false,
      })
      expect(out).toBe(turn)
      expect(getRuntimeCoordinatorTelemetry().runCount).toBe(0)
    })
  })
})
