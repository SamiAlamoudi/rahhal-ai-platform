/**
 * Integration Sprint 11 — Action Execution Layer tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  FUTURE_LIVE_ACTION_CAPABILITIES,
  INTEGRATION_ACTION_EXECUTION_FEATURE_ID,
  INTEGRATION_ACTION_EXECUTION_VERSION,
  createActionEngine,
  detectActionKind,
  enrichWithIntegrationActionExecution,
  executeActionSafely,
  isIntegrationActionExecutionEnabled,
  resetActionMemoryForTests,
  runActionExecution,
} from '../agent/integrationActionExecution'
import { emptyMemory, emptyRequirements, mergeRequirements, withTripPlan } from '../agent'
import { buildTripPlan } from '../agent/buildItinerary'
import type { AgentMemory } from '../agent/types'

function memoryWithTrip(): AgentMemory {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Dubai',
    destinations: ['Dubai'],
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    durationDays: 4,
    travelers: 2,
    budgetAmount: 7000,
    budgetCurrency: 'SAR',
    budgetStyle: 'midrange',
  })
  const base = emptyMemory('en')
  const plan = buildTripPlan({
    conversationId: 'action-execution-test',
    requirements,
    locale: 'en',
  })
  plan.flights = [{
    from: 'RUH',
    to: 'DXB',
    airline: 'EK',
    stops: 0,
    estimatedCost: 1600,
    currency: 'SAR',
    notes: null,
  }]
  plan.accommodations = [{
    name: 'Marina Suites',
    area: 'Marina',
    category: 'hotel',
    fit: 'Central',
    estimatedNightly: 480,
    currency: 'SAR',
  }]
  return withTripPlan({ ...base, requirements, missingFields: [] }, plan)
}

describe('Integration Sprint 11 — Action Execution Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetActionMemoryForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetActionMemoryForTests()
  })

  it('keeps integration action execution flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID)).toBe(false)
    expect(isIntegrationActionExecutionEnabled()).toBe(false)
    expect(INTEGRATION_ACTION_EXECUTION_VERSION).toMatch(/integration-action-execution/)
  })

  it('returns disabled when flag is OFF', async () => {
    const result = await runActionExecution({
      memory: memoryWithTrip(),
      userText: 'Book it.',
    })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('detects conversational action kinds', () => {
    expect(detectActionKind('Book it.')).toBe('book_flight')
    expect(detectActionKind('Reserve this hotel.')).toBe('reserve_hotel')
    expect(detectActionKind('Change my return flight.')).toBe('modify_booking')
    expect(detectActionKind('Cancel my booking.')).toBe('cancel_booking')
    expect(detectActionKind('Share my itinerary.')).toBe('share_trip')
    expect(detectActionKind('Save my itinerary.')).toBe('save_itinerary')
  })

  it('booking preview requires confirmation (no accidental book)', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID, true)
    const result = await runActionExecution({
      memory: memoryWithTrip(),
      userText: 'Book it.',
      deps: { enabled: true, userId: 'traveler-a' },
    })
    expect(result.ok).toBe(true)
    expect(result.action).toBe('book_flight')
    expect(result.mode).toBe('preview')
    expect(result.confirmation?.required).toBe(true)
    expect(result.confirmation?.confirmed).toBe(false)
    expect(result.memory.pending?.kind).toBe('book_flight')
    expect(result.stages).toContain('confirmation')
    expect(result.execution?.mode).toBe('preview')
    expect(result.consultantSummaryEn).toMatch(/confirm/i)
    expect(result.liveReady).toBe(false)
  })

  it('confirmation flow completes mock booking after confirm', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID, true)
    const engine = createActionEngine({ enabled: true, userId: 'traveler-b' })
    const preview = await engine.run({
      memory: memoryWithTrip(),
      userText: 'Book it.',
      deps: { enabled: true, userId: 'traveler-b' },
    })
    expect(preview.memory.pending).toBeTruthy()

    const confirmed = await engine.run({
      memory: memoryWithTrip(),
      userText: 'confirm',
      deps: { enabled: true, userId: 'traveler-b' },
    })
    expect(confirmed.intent).toBe('confirm_action')
    expect(confirmed.mode).toBe('mock')
    expect(confirmed.confirmation?.confirmed).toBe(true)
    expect(confirmed.execution?.success).toBe(true)
    expect(confirmed.execution?.orderId).toMatch(/mock_order/)
    expect(confirmed.memory.pending).toBeNull()
    expect(confirmed.memory.completed?.status).toBe('completed')
    expect(confirmed.memory.history.some((h) => h.status === 'completed')).toBe(true)
  })

  it('cancellation preview requires confirmation then mock cancel', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID, true)
    const preview = await runActionExecution({
      memory: memoryWithTrip(),
      userText: 'Cancel my booking.',
      deps: { enabled: true, userId: 'traveler-c' },
    })
    expect(preview.action).toBe('cancel_booking')
    expect(preview.confirmation?.kind).toBe('cancellation')
    expect(preview.mode).toBe('preview')

    const done = await runActionExecution({
      memory: memoryWithTrip(),
      userText: 'confirm',
      deps: { enabled: true, userId: 'traveler-c' },
    })
    expect(done.mode).toBe('mock')
    expect(done.execution?.success).toBe(true)
    expect(done.execution?.detailEn).toMatch(/cancellation/i)
  })

  it('blocks live execution mode', async () => {
    const live = await executeActionSafely({
      action: 'book_flight',
      mode: 'live',
    })
    expect(live.success).toBe(false)
    expect(live.liveBlocked).toBe(true)
    expect(FUTURE_LIVE_ACTION_CAPABILITIES.amadeusBooking).toBe(false)
    expect(FUTURE_LIVE_ACTION_CAPABILITIES.paymentGateway).toBe(false)
  })

  it('save / share run without confirmation (mock/local)', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID, true)
    const save = await runActionExecution({
      memory: memoryWithTrip(),
      userText: 'Save my itinerary.',
      deps: { enabled: true, userId: 'traveler-d' },
    })
    expect(save.ok).toBe(true)
    expect(save.action).toBe('save_itinerary')
    expect(save.confirmation?.required).toBe(false)
    expect(save.mode).toBe('mock')

    const share = await runActionExecution({
      memory: memoryWithTrip(),
      userText: 'Share my itinerary.',
      deps: { enabled: true, userId: 'traveler-e' },
    })
    expect(share.action).toBe('share_trip')
    expect(share.execution?.success).toBe(true)
  })

  it('soft-enriches trip notes when flag ON', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID, true)
    const memory = memoryWithTrip()
    const enriched = await enrichWithIntegrationActionExecution({
      memory,
      userText: 'Reserve this hotel.',
      force: true,
      deps: { enabled: true, userId: 'traveler-f' },
    })
    expect(enriched.actionExecution?.ok).toBe(true)
    expect(enriched.tripPlan?.notes.some((n) => /Action:|إجراء:/i.test(n))).toBe(true)
    expect(enriched.reply).toMatch(/confirm|Reserve|فندق|أؤكد/i)
  })

  it('regression: enrich is a no-op when flag OFF', async () => {
    const memory = memoryWithTrip()
    const enriched = await enrichWithIntegrationActionExecution({
      memory,
      userText: 'Book it.',
    })
    expect(enriched.actionExecution).toBeNull()
    expect(enriched.memory).toBe(memory)
  })

  it('performance: action path completes under budget', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_ACTION_EXECUTION_FEATURE_ID, true)
    const started = Date.now()
    for (let i = 0; i < 20; i++) {
      resetActionMemoryForTests()
      await runActionExecution({
        memory: memoryWithTrip(),
        userText: i % 2 === 0 ? 'Book it.' : 'Cancel my booking.',
        deps: { enabled: true, userId: `perf-${i}` },
      })
    }
    expect(Date.now() - started).toBeLessThan(1500)
  })
})
