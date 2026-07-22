/**
 * Sprint 118 — Editable AI Conversation production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { resetMemoryEngineStores } from '../agent/memory/index'
import {
  SPRINT118_EDITABLE_CONVERSATION_VERSION,
  EDITABLE_CONVERSATION_FEATURE_ID,
  isEditableConversationEnabled,
  runConversationEditor,
  createConversationEditor,
  analyzeEdit,
  buildEditPlan,
  planAffectedStages,
  buildEditDiff,
  createEditHistory,
  type EditSnapshot,
  type ConversationEditInput,
} from '../agent/editing'

function flight(id: string, price: number) {
  return {
    id,
    airline: 'Saudia',
    price,
    currency: 'SAR',
    durationMinutes: 200,
    stops: 0,
    cabin: 'economy',
    origin: 'RUH',
    destination: 'NRT',
    departureAt: '2026-10-05T08:00:00Z',
    arrivalAt: '2026-10-05T22:00:00Z',
    title: `Flight ${id}`,
    providerId: 'mock',
  }
}

function hotel(id: string, price: number) {
  return {
    id,
    hotelId: id,
    hotelName: `Hotel ${id}`,
    name: `Hotel ${id}`,
    price,
    currency: 'SAR',
    stars: 4,
    taxes: 0,
    freeCancellation: true,
    amenities: ['WIFI'],
    images: [],
    provider: 'mock',
    city: 'Tokyo',
    country: 'JP',
  }
}

function snapshot(overrides?: Partial<EditSnapshot>): EditSnapshot {
  return {
    trip: {
      origin: 'RUH',
      destination: 'Japan',
      departureDate: '2026-10-05',
      returnDate: '2026-10-15',
      checkInDate: '2026-10-05',
      checkOutDate: '2026-10-15',
      adults: 2,
      children: 0,
      budget: 15000,
      currency: 'SAR',
      cabin: 'economy',
      style: 'leisure',
    },
    flights: [flight('f1', 4200), flight('f2', 3800)],
    hotels: [hotel('h1', 900), hotel('h2', 1400)],
    confidence: 0.8,
    budget: 15000,
    cities: ['Tokyo', 'Kyoto'],
    ...overrides,
  }
}

function baseEdit(
  editText: string,
  snap: EditSnapshot = snapshot(),
): ConversationEditInput {
  return {
    conversationId: 'edit_118',
    userId: 'user_118',
    editText,
    snapshot: snap,
    basePipelineInput: {
      conversationId: 'edit_118',
      userId: 'user_118',
      trip: snap.trip,
      flights: snap.flights,
      hotels: snap.hotels,
      messages: [{ role: 'user', text: 'Plan a Japan trip' }],
    },
  }
}

describe('Sprint 118 — Editable AI Conversation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetMemoryEngineStores()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT118_EDITABLE_CONVERSATION_VERSION).toMatch(/editable/)
    expect(EDITABLE_CONVERSATION_FEATURE_ID).toBe('ai.editable_conversation')
    expect(getFeatureRegistry().isEnabled('ai.editable_conversation')).toBe(false)
    expect(isEditableConversationEnabled()).toBe(false)
  })

  describe('feature OFF/ON', () => {
    it('OFF returns disabled without planning', async () => {
      const result = await runConversationEditor(baseEdit('Change the hotel.'))
      expect(result.enabled).toBe(false)
      expect(result.ok).toBe(false)
      expect(result.plan).toBeNull()
      expect(result.logs).toContain('editable_conversation_disabled')
    })

    it('ON analyzes and partially reruns', async () => {
      const result = await runConversationEditor(baseEdit('Change the hotel.'), {
        enabled: true,
      })
      expect(result.enabled).toBe(true)
      expect(result.plan).toBeTruthy()
      expect(result.plan!.analyzed.kind).toBe('change_hotel')
      expect(result.stagesToRerun).toContain('hotel_search')
      expect(result.stagesToSkip).toContain('flight_search')
      expect(result.diff).toBeTruthy()
      expect(result.pipeline).toBeTruthy()
    })

    it('ON via registry', async () => {
      getFeatureRegistry().setEnabled('ai.editable_conversation', true)
      const result = await runConversationEditor(
        baseEdit('Increase budget to 18000 SAR.'),
      )
      expect(result.enabled).toBe(true)
      expect(result.plan!.analyzed.kind).toBe('change_budget')
    })
  })

  describe('change hotel', () => {
    it('clears hotels and skips flight search', async () => {
      const analyzed = analyzeEdit('Change the hotel.', snapshot())
      expect(analyzed.kind).toBe('change_hotel')
      expect(analyzed.clearHotels).toBe(true)
      expect(analyzed.clearFlights).toBe(false)
      const affected = planAffectedStages(analyzed)
      expect(affected.stagesToRerun).toContain('hotel_search')
      expect(affected.stagesToSkip).toContain('flight_search')
      expect(affected.estimatedExecutionTimeMs).toBeGreaterThan(0)

      const result = await runConversationEditor(baseEdit('Change the hotel.'), {
        enabled: true,
      })
      expect(result.stagesToSkip).toContain('memory')
      expect(result.whatChanged.some((c) => /hotel/i.test(c))).toBe(true)
    })
  })

  describe('change budget', () => {
    it('updates budget and diffs delta', async () => {
      const result = await runConversationEditor(
        baseEdit('Increase budget to 18,000 SAR.'),
        { enabled: true },
      )
      expect(result.plan!.analyzed.kind).toBe('change_budget')
      expect(result.plan!.afterTrip.budget).toBe(18000)
      expect(result.diff!.budgetDelta).toBe(3000)
      expect(result.stagesToSkip).toContain('flight_search')
      expect(result.stagesToRerun).toContain('trip_builder')
    })
  })

  describe('change destination', () => {
    it('clears flights and hotels', () => {
      const analyzed = analyzeEdit('Change destination to Korea', snapshot())
      expect(analyzed.kind).toBe('change_destination')
      expect(analyzed.tripPatch.destination).toBe('Korea')
      expect(analyzed.clearFlights).toBe(true)
      expect(analyzed.clearHotels).toBe(true)
      const plan = buildEditPlan(analyzed, snapshot())
      expect(plan.stagesToRerun).toContain('flight_search')
      expect(plan.stagesToRerun).toContain('hotel_search')
    })
  })

  describe('extend trip', () => {
    it('extends return/checkout and reruns itinerary', async () => {
      const result = await runConversationEditor(
        baseEdit('Stay two more days.'),
        { enabled: true },
      )
      expect(result.plan!.analyzed.kind).toBe('extend_trip')
      expect(result.plan!.analyzed.dayDelta).toBe(2)
      expect(result.plan!.afterTrip.returnDate).toBe('2026-10-17')
      expect(result.plan!.afterTrip.checkOutDate).toBe('2026-10-17')
      expect(result.stagesToRerun).toContain('itinerary')
      expect(result.stagesToRerun).toContain('trip_builder')
    })
  })

  describe('remove city', () => {
    it('plans trip builder + itinerary only (skips flight/hotel search)', async () => {
      const result = await runConversationEditor(baseEdit('Remove Kyoto.'), {
        enabled: true,
      })
      expect(result.plan!.analyzed.kind).toBe('remove_city')
      expect(result.plan!.analyzed.removedCities).toContain('Kyoto')
      expect(result.stagesToRerun).toContain('trip_builder')
      expect(result.stagesToRerun).toContain('itinerary')
      expect(result.stagesToSkip).toContain('flight_search')
      expect(result.stagesToSkip).toContain('hotel_search')
      expect(result.diff!.after.cities).not.toContain('Kyoto')
    })
  })

  describe('flight only / hotel only / cabin', () => {
    it('flight only skips hotel search', () => {
      const analyzed = analyzeEdit('flight only', snapshot())
      expect(analyzed.kind).toBe('flight_only')
      const plan = planAffectedStages(analyzed)
      expect(plan.stagesToRerun).toContain('flight_search')
      expect(plan.stagesToSkip).toContain('hotel_search')
    })

    it('hotel only skips flight search', () => {
      const analyzed = analyzeEdit('hotel only', snapshot())
      expect(analyzed.kind).toBe('hotel_only')
      const plan = planAffectedStages(analyzed)
      expect(plan.stagesToRerun).toContain('hotel_search')
      expect(plan.stagesToSkip).toContain('flight_search')
    })

    it('business class recalculates flights', async () => {
      const result = await runConversationEditor(baseEdit('Business class.'), {
        enabled: true,
      })
      expect(result.plan!.analyzed.kind).toBe('change_cabin')
      expect(result.plan!.afterTrip.cabin).toBe('business')
      expect(result.stagesToRerun).toContain('flight_search')
      expect(result.stagesToSkip).toContain('hotel_search')
    })
  })

  describe('multiple edits + history', () => {
    it('records history across sequential edits', async () => {
      const editor = createConversationEditor({ enabled: true })
      const results = await editor.editMany(
        ['Change the hotel.', 'Increase budget to 18000 SAR.'],
        {
          conversationId: 'edit_118_multi',
          userId: 'user_118',
          snapshot: snapshot(),
          basePipelineInput: baseEdit('x').basePipelineInput,
        },
      )
      expect(results).toHaveLength(2)
      expect(results[0]!.plan!.analyzed.kind).toBe('change_hotel')
      expect(results[1]!.plan!.analyzed.kind).toBe('change_budget')
      expect(editor.history.list().length).toBe(2)
      expect(editor.history.latest()?.kind).toBe('change_budget')
    })

    it('createEditHistory works standalone', () => {
      const history = createEditHistory()
      const analyzed = analyzeEdit('Change the hotel.', snapshot())
      const plan = buildEditPlan(analyzed, snapshot())
      const entry = history.recordPlan('Change the hotel.', plan, null, true)
      expect(entry.id).toMatch(/^edit_/)
      expect(history.list()).toHaveLength(1)
    })
  })

  describe('partial rerun + diff generation', () => {
    it('partial rerun skips unaffected stages', async () => {
      const result = await runConversationEditor(baseEdit('Change the hotel.'), {
        enabled: true,
      })
      expect(result.metadata!.stagesSkippedCount).toBeGreaterThan(0)
      expect(result.metadata!.partial).toBe(true)
      expect(result.estimatedExecutionTimeMs).toBeGreaterThan(0)
      // Skipped stages appear as skipped in pipeline stage records
      const skipped = result.pipeline!.stages.filter((s) => s.status === 'skipped')
      expect(skipped.length).toBeGreaterThan(0)
    })

    it('buildEditDiff produces before/after and deltas', () => {
      const snap = snapshot()
      const analyzed = analyzeEdit('Increase budget to 18000 SAR.', snap)
      const plan = buildEditPlan(analyzed, snap)
      const diff = buildEditDiff({
        plan,
        snapshot: snap,
        afterResult: null,
        executionTimeMs: 42,
      })
      expect(diff.before.budget).toBe(15000)
      expect(diff.after.budget).toBe(18000)
      expect(diff.budgetDelta).toBe(3000)
      expect(diff.timeDeltaMs).toBe(42)
      expect(diff.changes.length).toBeGreaterThan(0)
    })
  })
})
