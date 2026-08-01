/**
 * Sprint 83 — Agent Orchestrator architecture tests.
 * Flag remains OFF; orchestrator exercised with deps.enabled override only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  BRAIN_V1_FEATURE_ID,
  createAgentOrchestrator,
  createAgentRegistry,
  createDependencyGraph,
  DEFAULT_BRAIN_AGENTS,
  runBrainAgentOrchestrator,
  type BrainAgentId,
  type BrainV1Offer,
} from '../brain/v1'
import { emptyBrainV1Entities } from '../brain/v1/types'

const COMPLETE_ENTITIES = {
  ...emptyBrainV1Entities(),
  destination: 'Morocco',
  origin: 'Riyadh',
  travelDates: { start: '2026-10-01', end: null },
  adults: 2,
  travelerCount: 2,
  budget: 5000,
  currency: 'SAR',
}

function offers(): BrainV1Offer[] {
  return [
    {
      id: 'f1',
      kind: 'flight',
      title: 'Saudia',
      price: 2200,
      currency: 'SAR',
      durationMinutes: 360,
      stops: 0,
      airline: 'Saudia',
    },
    {
      id: 'h1',
      kind: 'hotel',
      title: 'Riad',
      price: 900,
      currency: 'SAR',
      hotelRating: 4,
      freeCancellation: true,
    },
  ]
}

describe('Sprint 83 — Agent Orchestrator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('feature isolation', () => {
    it('keeps ai.brain.v1 OFF and no-ops when disabled', async () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      const result = await runBrainAgentOrchestrator({
        text: 'flight to Morocco',
        intentHint: 'flight_search',
      })
      expect(result.enabled).toBe(false)
      expect(result.executionOrder).toEqual([])
      expect(result.telemetry.events).toEqual([])
    })
  })

  describe('registry', () => {
    it('registers every agent without hardcoded orchestrator agent lists', () => {
      const registry = createAgentRegistry()
      for (const agent of DEFAULT_BRAIN_AGENTS) registry.register(agent)
      expect(registry.size()).toBe(13)
      expect(registry.ids().sort()).toEqual([
        'booking',
        'flight',
        'hotel',
        'maps',
        'memory',
        'package',
        'planner',
        'pricing',
        'response',
        'safety',
        'travel',
        'visa',
        'weather',
      ])
      expect(() => registry.register(DEFAULT_BRAIN_AGENTS[0]!)).toThrow(/already registered/)
    })
  })

  describe('lifecycle', () => {
    it('moves selected agents through ready → executing → completed', async () => {
      const result = await runBrainAgentOrchestrator(
        {
          text: 'flight to Morocco from Riyadh',
          intent: { intent: 'flight_search', confidence: 0.9, secondary: [] },
          entities: COMPLETE_ENTITIES,
          missing: [],
          tools: ['flights'],
          candidateOffers: offers(),
        },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.lifecycleSnapshot.planner).toBe('completed')
      expect(result.lifecycleSnapshot.memory).toBe('completed')
      expect(result.lifecycleSnapshot.response).toBe('completed')
      expect(result.telemetry.events.every((e) => e.lifecycle === 'completed')).toBe(true)
    })
  })

  describe('dependencies', () => {
    it('schedules booking after planner, flight, hotel, and pricing when selected', () => {
      const graph = createDependencyGraph()
      const registry = createAgentRegistry()
      for (const agent of DEFAULT_BRAIN_AGENTS) registry.register(agent)
      const selected: BrainAgentId[] = [
        'planner',
        'memory',
        'travel',
        'flight',
        'hotel',
        'pricing',
        'booking',
        'safety',
        'response',
      ]
      const defMap = new Map(selected.map((id) => [id, registry.get(id)!]))
      const batches = graph.buildBatches(selected, defMap)
      const order = graph.flatten(batches)
      expect(order.indexOf('planner')).toBeLessThan(order.indexOf('booking'))
      expect(order.indexOf('flight')).toBeLessThan(order.indexOf('pricing'))
      expect(order.indexOf('hotel')).toBeLessThan(order.indexOf('pricing'))
      expect(order.indexOf('pricing')).toBeLessThan(order.indexOf('booking'))
      expect(order.indexOf('booking')).toBeLessThan(order.indexOf('safety'))
      expect(order.indexOf('safety')).toBeLessThan(order.indexOf('response'))
    })
  })

  describe('parallel execution', () => {
    it('runs weather, maps, and visa in the same parallel batch', async () => {
      const result = await runBrainAgentOrchestrator(
        {
          text: 'family vacation to Morocco',
          intent: { intent: 'family_vacation', confidence: 0.9, secondary: [] },
          entities: COMPLETE_ENTITIES,
          missing: [],
          tools: ['flights', 'hotels', 'packages'],
          candidateOffers: offers(),
        },
        { enabled: true },
      )
      const contextBatch = result.parallelBatches.find(
        (batch) =>
          batch.includes('weather') && batch.includes('maps') && batch.includes('visa'),
      )
      expect(contextBatch).toBeTruthy()
    })
  })

  describe('recovery / retry', () => {
    it('retries temporary failures then completes', async () => {
      const result = await runBrainAgentOrchestrator(
        {
          text: 'flight to Morocco',
          intent: { intent: 'flight_search', confidence: 0.9, secondary: [] },
          entities: COMPLETE_ENTITIES,
          missing: [],
          tools: ['flights'],
          candidateOffers: offers(),
        },
        {
          enabled: true,
          failureInjector: {
            weather: { kind: 'temporary_failure', failAttempts: 1 },
          },
        },
      )
      const weatherEvent = result.telemetry.events.find((e) => e.agentId === 'weather')
      expect(weatherEvent).toBeTruthy()
      expect(weatherEvent!.retries).toBeGreaterThanOrEqual(1)
      expect(weatherEvent!.ok).toBe(true)
      expect(result.lifecycleSnapshot.weather).toBe('completed')
      expect(result.telemetry.retries).toBeGreaterThanOrEqual(1)
    })
  })

  describe('telemetry', () => {
    it('records execution time, failures, retries, tools, and planner decisions', async () => {
      const result = await runBrainAgentOrchestrator(
        {
          text: 'flight to Morocco',
          intent: { intent: 'flight_search', confidence: 0.9, secondary: [] },
          entities: COMPLETE_ENTITIES,
          missing: [],
          tools: ['flights'],
          candidateOffers: offers(),
        },
        {
          enabled: true,
          failureInjector: {
            maps: { kind: 'provider_unavailable', failAttempts: 1 },
          },
        },
      )
      expect(result.telemetry.totalDurationMs).toBeGreaterThanOrEqual(0)
      expect(result.telemetry.events.length).toBeGreaterThan(0)
      expect(result.telemetry.plannerDecisions.length).toBeGreaterThan(0)
      expect(result.telemetry.events.some((e) => e.selectedTools.includes('flights'))).toBe(true)
      expect(result.telemetry.retries).toBeGreaterThanOrEqual(1)
      expect(result.telemetry.failures).toBeGreaterThanOrEqual(1)
    })
  })

  describe('planner selection', () => {
    it('selects agents from registry predicates (not a hardcoded execution list)', async () => {
      const orchestrator = createAgentOrchestrator()
      const result = await orchestrator.run(
        {
          text: 'do I need a visa for Japan',
          intent: { intent: 'visa_question', confidence: 0.95, secondary: [] },
          entities: {
            ...emptyBrainV1Entities(),
            visaDestination: 'Japan',
            destination: 'Japan',
          },
          missing: [],
          tools: ['visa'],
        },
        { enabled: true },
      )
      const ids = result.selectedAgents.map((s) => s.agentId)
      expect(ids).toContain('planner')
      expect(ids).toContain('visa')
      expect(ids).toContain('response')
      expect(ids).not.toContain('flight')
      expect(ids).not.toContain('pricing')
    })
  })

  describe('explainability', () => {
    it('records why every selected agent was chosen', async () => {
      const result = await runBrainAgentOrchestrator(
        {
          text: 'flight to Morocco',
          intent: { intent: 'flight_search', confidence: 0.9, secondary: [] },
          entities: COMPLETE_ENTITIES,
          missing: [],
          tools: ['flights'],
          candidateOffers: offers(),
        },
        { enabled: true },
      )
      expect(result.selectedAgents.length).toBeGreaterThan(0)
      for (const selection of result.selectedAgents) {
        expect(selection.reason.length).toBeGreaterThan(5)
      }
      expect(
        result.selectedAgents.find((s) => s.agentId === 'flight')?.reason,
      ).toMatch(/flight/i)
      expect(result.telemetry.plannerDecisions).toEqual(result.selectedAgents)
    })
  })

  describe('end-to-end orchestrated turn', () => {
    it('produces ranked offers, booking stub, and response via agent graph', async () => {
      const result = await runBrainAgentOrchestrator(
        {
          text: 'flight and hotel to Morocco',
          intent: { intent: 'package_search', confidence: 0.9, secondary: [] },
          entities: COMPLETE_ENTITIES,
          missing: [],
          tools: ['flights', 'hotels', 'packages'],
          candidateOffers: offers(),
        },
        { enabled: true },
      )
      expect(result.context.providerResults.map((o) => o.id).sort()).toEqual(['f1', 'h1'])
      expect(result.context.rankedOffers[0]?.id).toBeTruthy()
      expect(result.context.bookingActions[0]?.type).toBe('prepare_booking')
      expect(result.context.responseEn.toLowerCase()).toMatch(/recommend/)
      expect(result.context.safe).toBe(true)
    })
  })
})
