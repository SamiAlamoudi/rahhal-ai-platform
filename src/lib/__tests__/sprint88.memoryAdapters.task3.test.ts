/**
 * Sprint 88 Task 3 — Memory adapters (in-memory only).
 * Not wired into planTurn / BrainRouter — default-OFF behavior unchanged.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory, type TripPlan } from '../agent/types'
import {
  BRAIN_V1_FEATURE_ID,
  BRAIN_V1_PREVIEW_FEATURE_ID,
  MEMORY_PROVENANCE_CONTRACT_VERSION,
  TRIP_MEMORY_ADAPTER_VERSION,
  USER_PREFERENCE_ADAPTER_VERSION,
  WORKING_MEMORY_ADAPTER_VERSION,
  createMemoryFactProvenance,
  createTripMemoryAdapter,
  createUserPreferenceAdapter,
  createWorkingMemoryAdapter,
  resolveProvenanceConflict,
  routeBrainPreviewTurn,
} from '../brain/v1'
import type { ChatMessage } from '../chat/chatTypes'
import { RECOVERY_TURN_OWNER } from '../recovery/freeze'

function msg(
  role: 'user' | 'assistant',
  content: string,
  conversationId = 's88-t3',
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
    providerMeta: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

function samplePlan(id: string): TripPlan {
  const memory = emptyMemory('en')
  const budget = { amount: 0, currency: 'SAR', breakdown: [] as [] }
  return {
    id,
    title: 'Trip',
    summary: '',
    locale: 'en',
    destinations: ['Morocco'],
    startDate: null,
    endDate: null,
    durationDays: 0,
    travelers: null,
    travelerType: null,
    interests: [],
    dailyItinerary: [],
    activities: [],
    transportation: [],
    flights: [],
    accommodations: [],
    attractions: [],
    weatherNotes: [],
    visaNotes: [],
    travelTips: [],
    packingSuggestions: [],
    estimatedBudget: budget,
    estimatedCosts: budget,
    notes: [],
    conversationId: 's88-t3',
    requirements: memory.requirements,
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

describe('Sprint 88 Task 3 — Memory adapters', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps flags OFF and recovery owner unchanged', () => {
    expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
    expect(getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID)).toBe(false)
    expect(RECOVERY_TURN_OWNER).toBe('travelAgentService.planTurn')
    expect(MEMORY_PROVENANCE_CONTRACT_VERSION).toMatch(/provenance/)
    expect(WORKING_MEMORY_ADAPTER_VERSION).toMatch(/working/)
    expect(USER_PREFERENCE_ADAPTER_VERSION).toMatch(/preference/)
    expect(TRIP_MEMORY_ADAPTER_VERSION).toMatch(/trip/)
  })

  describe('WorkingMemoryAdapter', () => {
    it('applies incremental slots without wiping unrelated fields', () => {
      const adapter = createWorkingMemoryAdapter()
      const base = emptyMemory('en')
      const step1 = adapter.applyIncremental(base, {
        destination: 'Morocco',
        origin: 'Riyadh',
      })
      expect(step1.memory.requirements.destination).toBe('Morocco')
      expect(step1.memory.requirements.origin).toBe('Riyadh')

      const step2 = adapter.applyIncremental(
        step1.memory,
        { startDate: '2026-10-01' },
        { priorProvenance: step1.provenance, source: 'user_stated' },
      )
      expect(step2.memory.requirements.destination).toBe('Morocco')
      expect(step2.memory.requirements.origin).toBe('Riyadh')
      expect(step2.memory.requirements.startDate).toBe('2026-10-01')
      expect(step2.provenance.destination?.source).toBe('user_stated')
      expect(step2.memory.fieldProvenance?.destination?.value).toBe('Morocco')

      const snap = adapter.read(step2.memory, step2.provenance)
      expect(snap.slots.destination).toBe('Morocco')
      expect(snap.planId).toBeNull()
    })

    it('user_stated wins over assumed on conflict', () => {
      const assumed = createMemoryFactProvenance({
        field: 'destination',
        value: 'Paris',
        source: 'assumed',
        updatedAt: '2026-08-01T01:00:00.000Z',
      })
      const stated = createMemoryFactProvenance({
        field: 'destination',
        value: 'Morocco',
        source: 'user_stated',
        updatedAt: '2026-08-01T00:00:00.000Z',
      })
      expect(resolveProvenanceConflict(assumed, stated).value).toBe('Morocco')
      expect(resolveProvenanceConflict(stated, assumed).value).toBe('Morocco')
    })
  })

  describe('UserPreferenceAdapter', () => {
    it('reads preferences and applies soft defaults only to empty slots', () => {
      const adapter = createUserPreferenceAdapter()
      const snap = adapter.read({
        preferenceMemory: {
          cabinClass: 'business',
          currency: 'SAR',
          typicalBudget: 8000,
          preferredAirlines: ['SV'],
        },
      })
      expect(snap.preferences.cabinClass).toBe('business')
      expect(snap.publicView.cabinClass).toBe('business')

      const memory = emptyMemory('en')
      memory.requirements.cabinPreference = 'economy'
      const applied = adapter.applySoftDefaults(memory, snap.preferences)
      // Existing cabin not overwritten.
      expect(applied.memory.requirements.cabinPreference).toBe('economy')
      expect(applied.applied).not.toContain('cabinPreference')
      expect(applied.applied).toContain('budgetCurrency')
      expect(applied.memory.requirements.budgetCurrency).toBe('SAR')
      expect(applied.memory.requirements.preferredAirline).toBe('SV')
    })
  })

  describe('TripMemoryAdapter', () => {
    it('invalidates trip plan, selection, and trip-scoped provenance on new trip', () => {
      const trip = createTripMemoryAdapter()
      const working = createWorkingMemoryAdapter()
      let memory = emptyMemory('en')
      const withSlots = working.applyIncremental(memory, {
        destination: 'Morocco',
        cabinPreference: 'business',
      })
      memory = withSlots.memory
      memory = trip.attachTripPlan(memory, samplePlan('plan_old'))
      memory = {
        ...memory,
        selectedBookingOption: {
          id: 'f1',
          kind: 'flight',
          label: 'SV123',
          price: 1000,
          currency: 'SAR',
        },
      }

      const tripScoped = createMemoryFactProvenance({
        field: 'offerSelection',
        value: 'f1',
        source: 'provider_sourced',
        planId: 'plan_old',
      })
      const prefFact = createMemoryFactProvenance({
        field: 'cabinPreference',
        value: 'business',
        source: 'user_stated',
        planId: null,
      })

      const invalidated = trip.invalidateForNewTrip(memory, 'plan_new', {
        priorProvenance: {
          offerSelection: tripScoped,
          cabinPreference: prefFact,
        },
        tripAssumptions: [tripScoped],
      })

      expect(invalidated.memory.tripPlan).toBeNull()
      expect(invalidated.memory.itinerary).toBeNull()
      expect(invalidated.memory.selectedBookingOption).toBeNull()
      // Working destination / cabin kept.
      expect(invalidated.memory.requirements.destination).toBe('Morocco')
      expect(invalidated.memory.requirements.cabinPreference).toBe('business')
      expect(invalidated.provenance.cabinPreference?.value).toBe('business')
      expect(invalidated.provenance.offerSelection).toBeUndefined()
      expect(invalidated.cleared.tripPlan).toBe(true)
      expect(invalidated.cleared.selectedBooking).toBe(true)
      expect(invalidated.cleared.tripAssumptionCount).toBeGreaterThanOrEqual(1)

      const snap = trip.read(invalidated.memory)
      expect(snap.planId).toBeNull()
    })
  })

  describe('no runtime wiring', () => {
    it('BrainRouter path unchanged (toolBatch null; adapters unused)', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'I want to travel to Morocco.',
        locale: 'en',
        conversationId: 's88-t3',
        messages: [msg('user', 'I want to travel to Morocco.')],
        memory: emptyMemory('en'),
        enabled: true,
        bypassDeployGateForTests: true,
      })
      expect(decision.path).toBe('brain')
      if (decision.path !== 'brain') return
      expect(decision.result.toolBatch).toBeNull()
    })

    it('planTurn preview OFF unchanged', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: false })
      const result = await service.planTurn({
        conversationId: 's88-t3-off',
        messages: [msg('user', 'I want to travel to Morocco.', 's88-t3-off')],
      })
      expect(result.meta.brainV1Preview).toBeUndefined()
      expect(result.reply.length).toBeGreaterThan(0)
    })
  })
})
