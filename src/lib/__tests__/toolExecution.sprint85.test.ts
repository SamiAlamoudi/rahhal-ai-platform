/**
 * Sprint 85 — Tool Execution Engine architecture tests.
 * Flag remains OFF; engine exercised with deps.enabled override only.
 * Mock simulator only — no real provider calls.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  BRAIN_V1_FEATURE_ID,
  buildDefaultTripDecisions,
  createCancellationToken,
  createDependencyResolver,
  createResultMerger,
  createToolExecutionEngine,
  emptyTravelPlanSlots,
  runToolExecution,
  type ToolDecision,
  type UnifiedToolResult,
} from '../brain/v1'

const SLOTS = {
  ...emptyTravelPlanSlots(),
  destination: 'Morocco',
  origin: 'Riyadh',
  dates: { start: '2026-10-01', end: '2026-10-07' },
  adults: 2,
  currency: 'SAR',
  budget: 5000,
}

describe('Sprint 85 — Tool Execution Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('feature isolation', () => {
    it('keeps ai.brain.v1 OFF and no-ops when disabled', async () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      const result = await runToolExecution({
        decisions: buildDefaultTripDecisions(),
        knownSlots: SLOTS,
      })
      expect(result.enabled).toBe(false)
      expect(result.results).toEqual([])
      expect(result.safetyBlocks[0]?.reason).toMatch(/disabled/i)
    })
  })

  describe('sequential execution', () => {
    it('runs tools in dependency order (pricing after flights/hotels)', async () => {
      const decisions: ToolDecision[] = [
        { tool: 'flights', reason: 'flights', params: {}, policy: 'sequential' },
        { tool: 'hotels', reason: 'hotels', params: {}, policy: 'sequential' },
        {
          tool: 'pricing',
          reason: 'pricing',
          params: {},
          policy: 'sequential',
          dependsOn: ['flights', 'hotels'],
        },
      ]
      const result = await runToolExecution(
        { decisions, knownSlots: SLOTS },
        { enabled: true },
      )
      const order = result.batches.flat()
      expect(order.indexOf('flights')).toBeLessThan(order.indexOf('pricing'))
      expect(order.indexOf('hotels')).toBeLessThan(order.indexOf('pricing'))
      expect(result.results.find((r) => r.tool === 'pricing')?.ok).toBe(true)
    })
  })

  describe('parallel execution', () => {
    it('executes weather, maps, visa, currency in one batch', async () => {
      const decisions: ToolDecision[] = [
        { tool: 'weather', reason: 'w', params: {}, policy: 'parallel' },
        { tool: 'maps', reason: 'm', params: {}, policy: 'parallel' },
        { tool: 'visa', reason: 'v', params: {}, policy: 'parallel' },
        { tool: 'currency', reason: 'c', params: {}, policy: 'parallel' },
      ]
      const result = await runToolExecution(
        { decisions, knownSlots: SLOTS },
        { enabled: true },
      )
      expect(result.batches.length).toBe(1)
      expect(result.batches[0]?.sort()).toEqual(
        ['currency', 'maps', 'visa', 'weather'].sort(),
      )
      expect(result.results.every((r) => r.ok && r.meta.simulated)).toBe(true)
    })
  })

  describe('dependencies', () => {
    it('keeps booking after flights, hotels, and pricing', () => {
      const resolver = createDependencyResolver()
      const decisions = buildDefaultTripDecisions({ includeBooking: true })
      const batches = resolver.buildBatches(decisions)
      const order = batches.flat()
      expect(order.indexOf('flights')).toBeLessThan(order.indexOf('pricing'))
      expect(order.indexOf('hotels')).toBeLessThan(order.indexOf('pricing'))
      expect(order.indexOf('pricing')).toBeLessThan(order.indexOf('booking'))
      expect(order.indexOf('flights')).toBeLessThan(order.indexOf('booking'))
      expect(order.indexOf('hotels')).toBeLessThan(order.indexOf('booking'))
    })
  })

  describe('retries and recovery', () => {
    it('retries temporary failures then succeeds', async () => {
      const result = await runToolExecution(
        {
          decisions: [
            { tool: 'weather', reason: 'w', params: {}, policy: 'retry' },
          ],
          knownSlots: SLOTS,
          failureInjector: {
            weather: { failAttempts: 1, error: 'temporary_failure' },
          },
        },
        { enabled: true },
      )
      const event = result.telemetry.events.find((e) => e.tool === 'weather')
      expect(event?.retries).toBeGreaterThanOrEqual(1)
      expect(event?.success).toBe(true)
      expect(result.telemetry.retries).toBeGreaterThanOrEqual(1)
    })

    it('uses fallback and continues with remaining tools', async () => {
      const result = await runToolExecution(
        {
          decisions: [
            {
              tool: 'flights',
              reason: 'f',
              params: {},
              policy: 'fallback',
              fallback: 'knowledge',
            },
            { tool: 'weather', reason: 'w', params: {}, policy: 'parallel' },
          ],
          knownSlots: SLOTS,
          failureInjector: {
            flights: { failAttempts: 5, error: 'provider_unavailable' },
          },
        },
        { enabled: true },
      )
      const flights = result.results.find((r) => r.tool === 'flights')
      expect(flights?.status).toBe('fallback')
      expect(result.telemetry.fallbacks).toBeGreaterThanOrEqual(1)
      expect(result.results.find((r) => r.tool === 'weather')?.ok).toBe(true)
    })
  })

  describe('cancellation', () => {
    it('honours cancellation token', async () => {
      const token = createCancellationToken()
      token.cancel('user_abort')
      const result = await runToolExecution(
        {
          decisions: [
            { tool: 'flights', reason: 'f', params: {}, policy: 'cancel' },
          ],
          knownSlots: SLOTS,
          cancellationToken: token,
        },
        { enabled: true },
      )
      expect(result.cancelled).toBe(true)
      expect(result.results[0]?.status).toBe('cancelled')
    })
  })

  describe('result merge', () => {
    it('merges into unified structure without provider payloads', async () => {
      const result = await runToolExecution(
        {
          decisions: buildDefaultTripDecisions({ includeBooking: true }),
          knownSlots: SLOTS,
          conversationSummary: 'Trip to Morocco',
          memoryNotes: ['prefers Saudia'],
        },
        { enabled: true },
      )
      expect(result.merged.items.length).toBeGreaterThan(0)
      expect(result.merged.byTool.flights?.meta.source).toBe('execution_simulator')
      expect(result.merged.summary).toMatch(/Merged/)
      // Booking stub is not a real booking execution.
      expect(result.merged.byTool.booking?.items[0]?.attributes?.executable).toBe(false)

      const merger = createResultMerger()
      const polluted: UnifiedToolResult = {
        tool: 'flights',
        ok: true,
        status: 'succeeded',
        items: [{
          id: 'x',
          kind: 'flights',
          title: 'x',
          attributes: {
            stops: 0,
            raw_provider_payload: 'SECRET',
            amadeus_offer: 'SECRET',
          },
        }],
        summary: 'x',
        meta: { simulated: true, source: 'execution_simulator', attempts: 1 },
      }
      const cleaned = merger.merge([polluted])
      expect(cleaned.items[0]?.attributes?.raw_provider_payload).toBeUndefined()
      expect(cleaned.items[0]?.attributes?.amadeus_offer).toBeUndefined()
      expect(cleaned.items[0]?.attributes?.stops).toBe(0)
    })
  })

  describe('telemetry', () => {
    it('records selection, timing, retries, failures, fallback, success', async () => {
      const result = await runToolExecution(
        {
          decisions: [
            {
              tool: 'maps',
              reason: 'm',
              params: {},
              policy: 'retry',
              fallback: 'knowledge',
            },
          ],
          knownSlots: SLOTS,
          failureInjector: {
            maps: { failAttempts: 1, error: 'temporary_failure' },
          },
        },
        { enabled: true },
      )
      const event = result.telemetry.events[0]
      expect(event?.selected).toBe(true)
      expect(event?.durationMs).toBeGreaterThanOrEqual(0)
      expect(event?.success).toBe(true)
      expect(result.telemetry.totalDurationMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('safety', () => {
    it('blocks tools missing required slots, permissions, or rate limits', async () => {
      const engine = createToolExecutionEngine()
      const incomplete = await engine.run(
        {
          decisions: [
            { tool: 'flights', reason: 'f', params: {} },
          ],
          knownSlots: { ...emptyTravelPlanSlots(), destination: 'Morocco' },
        },
        { enabled: true },
      )
      expect(incomplete.results[0]?.status).toBe('skipped')
      expect(incomplete.safetyBlocks.some((b) => b.reason.includes('dates'))).toBe(true)

      const denied = await engine.run(
        {
          decisions: [{ tool: 'weather', reason: 'w', params: {} }],
          knownSlots: SLOTS,
          permissions: { weather: false },
        },
        { enabled: true },
      )
      expect(denied.results[0]?.status).toBe('skipped')
      expect(denied.safetyBlocks.some((b) => b.reason === 'permission_denied')).toBe(true)

      const limited = await engine.run(
        {
          decisions: [
            { tool: 'currency', reason: 'c', params: {} },
            { tool: 'knowledge', reason: 'k', params: {} },
          ],
          knownSlots: SLOTS,
          rateLimits: { currency: 0 },
        },
        { enabled: true },
      )
      expect(limited.results.find((r) => r.tool === 'currency')?.status).toBe('skipped')
      expect(limited.results.find((r) => r.tool === 'knowledge')?.ok).toBe(true)
    })
  })

  describe('simulator', () => {
    it('returns deterministic fake data only', async () => {
      const a = await runToolExecution(
        {
          decisions: [{ tool: 'flights', reason: 'f', params: {} }],
          knownSlots: SLOTS,
        },
        { enabled: true },
      )
      const b = await runToolExecution(
        {
          decisions: [{ tool: 'flights', reason: 'f', params: {} }],
          knownSlots: SLOTS,
        },
        { enabled: true },
      )
      expect(a.results[0]?.items).toEqual(b.results[0]?.items)
      expect(a.results[0]?.meta.simulated).toBe(true)
      expect(a.results[0]?.items[0]?.id).toBe('flights_direct')
    })
  })
})
