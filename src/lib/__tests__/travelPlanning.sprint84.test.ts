/**
 * Sprint 84 — Travel Planning Engine architecture tests.
 * Flag remains OFF; engine exercised with deps.enabled override only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  BRAIN_V1_FEATURE_ID,
  createItinerarySkeletonBuilder,
  createPlanValidator,
  createQuestionPlanner,
  createSlotFillingEngine,
  createTravelPlanningEngine,
  emptyTravelPlanSlots,
  runTravelPlanningTurn,
} from '../brain/v1'

describe('Sprint 84 — Travel Planning Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('feature isolation', () => {
    it('keeps ai.brain.v1 OFF and no-ops when disabled', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      const result = runTravelPlanningTurn({ text: 'I want to travel to Morocco.' })
      expect(result.enabled).toBe(false)
      expect(result.plan).toBeNull()
      expect(result.nextQuestion).toBeNull()
    })
  })

  describe('goal creation', () => {
    it('creates a Travel Goal for Morocco destination-only request', () => {
      const result = runTravelPlanningTurn(
        { text: 'I want to travel to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(result.enabled).toBe(true)
      expect(result.goal?.label).toBe('Travel to Morocco')
      expect(result.goal?.goalId).toBeTruthy()
      expect(result.goal?.intent).toBe('flight_search')
      expect(result.goal?.status).toBe('waiting_user')
      expect(result.goal?.confidence).toBeGreaterThan(0)
      expect(result.goal?.createdAt).toBeTruthy()
      expect(result.goal?.updatedAt).toBeTruthy()
      expect(result.known.destination).toBe('Morocco')
      expect(result.missing).toEqual(expect.arrayContaining(['dates']))
      expect(result.missing).toContain('dates')
      // Departure city + travelers are known missing conceptually after dates path.
      expect(result.nextQuestion?.questionEn).toBe('When would you like to travel?')
      expect(result.conversationState).toBe('WaitingUser')
      expect(result.plan?.completionStatus).toBe('incomplete')
    })
  })

  describe('slot filling', () => {
    it('fills supported slots from natural language', () => {
      const slots = createSlotFillingEngine()
      const patch = slots.extract(
        'from Riyadh to Morocco 2026-10-01 to 2026-10-07 adults 2 children 1 business budget 8000 SAR beach 4 stars taxi',
      )
      const merged = slots.merge(emptyTravelPlanSlots(), patch)
      expect(merged.origin).toBe('Riyadh')
      expect(merged.destination).toBe('Morocco')
      expect(merged.dates.start).toBe('2026-10-01')
      expect(merged.dates.end).toBe('2026-10-07')
      expect(merged.adults).toBe(2)
      expect(merged.children).toBe(1)
      expect(merged.cabin).toBe('business')
      expect(merged.budget).toBe(8000)
      expect(merged.currency).toBe('SAR')
      expect(merged.activities).toContain('beach')
      expect(merged.hotelPreference).toBe('4-star')
      expect(merged.transportation).toBeTruthy()
    })
  })

  describe('conversation states', () => {
    it('moves WaitingUser → Ready as slots complete', () => {
      const engine = createTravelPlanningEngine()
      const first = engine.planTurn(
        { text: 'I want to travel to Morocco.' },
        { enabled: true },
      )
      expect(first.conversationState).toBe('WaitingUser')

      const second = engine.planTurn(
        {
          text: '2026-10-01 from Riyadh adults 2',
          priorPlan: first.plan,
        },
        { enabled: true },
      )
      expect(second.conversationState).toBe('Ready')
      expect(second.plan?.completionStatus).toBe('ready_for_providers')
      expect(second.missing).toEqual([])
    })
  })

  describe('question selection', () => {
    it('asks only one highest-priority missing question', () => {
      const q = createQuestionPlanner().nextQuestion(['adults', 'dates', 'origin', 'budget'])
      expect(q?.slot).toBe('dates')
      expect(q?.questionEn).toMatch(/when/i)

      const turn = runTravelPlanningTurn(
        { text: 'I want to go to Morocco.', locale: 'en' },
        { enabled: true },
      )
      expect(turn.nextQuestion).not.toBeNull()
      expect(turn.nextQuestion?.slot).toBe('dates')
      // Never a multi-question dump.
      expect(turn.nextQuestion?.questionEn.includes('?')).toBe(true)
      expect(turn.nextQuestion?.questionEn.toLowerCase()).not.toMatch(/budget.*cabin/)
    })
  })

  describe('revision', () => {
    it('updates only affected parts when destination changes', () => {
      const engine = createTravelPlanningEngine()
      const ready = engine.planTurn(
        {
          text: 'flight to Morocco from Riyadh 2026-10-01 adults 2 budget 5000',
        },
        { enabled: true },
      )
      expect(ready.plan?.completionStatus).toBe('ready_for_providers')
      const planId = ready.plan!.planId
      const goalId = ready.plan!.goal.goalId
      const stepCount = ready.plan!.executionSteps.length

      const revised = engine.planTurn(
        {
          text: 'actually change destination to Dubai',
          priorPlan: ready.plan,
        },
        { enabled: true },
      )
      expect(revised.plan?.planId).toBe(planId)
      expect(revised.plan?.goal.goalId).toBe(goalId)
      expect(revised.plan?.executionSteps.length).toBe(stepCount)
      expect(revised.known.destination).toBe('Dubai')
      expect(revised.revisedSlots).toContain('destination')
      expect(revised.plan?.revisions.at(-1)?.changedSlots).toContain('destination')
      expect(revised.conversationState).toMatch(/UpdatingPlan|Ready|WaitingUser/)
      // Unaffected known slots preserved.
      expect(revised.known.origin).toBe('Riyadh')
      expect(revised.known.adults).toBe(2)
    })
  })

  describe('recovery', () => {
    it('resumes unfinished planning and reuses prior context', () => {
      const engine = createTravelPlanningEngine()
      const first = engine.planTurn(
        { text: 'I want to travel to Morocco.' },
        { enabled: true },
      )
      expect(first.conversationState).toBe('WaitingUser')

      const resumed = engine.planTurn(
        {
          text: '2026-11-15',
          priorPlan: first.plan,
          interrupted: true,
        },
        { enabled: true },
      )
      expect(resumed.recovered).toBe(true)
      expect(resumed.known.destination).toBe('Morocco')
      expect(resumed.known.dates).toMatchObject({ start: '2026-11-15' })
      expect(resumed.plan?.plannerNotes.join(' ')).toMatch(/Recovered/i)
      expect(resumed.nextQuestion?.slot).toBe('origin')
    })
  })

  describe('validation', () => {
    it('detects impossible dates, invalid travelers, and budget conflicts', () => {
      const validator = createPlanValidator()
      const slots = {
        ...emptyTravelPlanSlots(),
        destination: 'Morocco',
        origin: 'Morocco',
        dates: { start: '2026-10-10', end: '2026-10-01' },
        adults: 0,
        children: -1,
        budget: -50,
        cabin: 'business',
      }
      const result = validator.validate(slots)
      expect(result.ok).toBe(false)
      expect(result.issues.some((i) => i.kind === 'impossible_dates')).toBe(true)
      expect(result.issues.some((i) => i.kind === 'invalid_travelers')).toBe(true)
      expect(result.issues.some((i) => i.kind === 'budget_conflict')).toBe(true)
      expect(result.issues.some((i) => i.kind === 'conflict')).toBe(true)
    })
  })

  describe('itinerary generation', () => {
    it('builds a provider-independent itinerary skeleton', () => {
      const skeleton = createItinerarySkeletonBuilder().build({
        ...emptyTravelPlanSlots(),
        destination: 'Morocco',
        origin: 'Riyadh',
        dates: { start: '2026-10-01', end: '2026-10-04' },
        adults: 2,
        activities: ['beach', 'culture'],
        hotelPreference: 'riad',
        transportation: 'taxi',
        budget: 5000,
        currency: 'SAR',
        flexibleDates: null,
        children: null,
        cabin: null,
        visa: null,
        language: null,
        specialRequests: null,
      })
      expect(skeleton.days.length).toBe(4)
      expect(skeleton.days[0]?.flights[0]).toMatch(/Riyadh → Morocco/)
      expect(skeleton.days[0]?.hotels[0]).toMatch(/riad/i)
      expect(skeleton.days.some((d) => d.activities.length > 0)).toBe(true)
      expect(skeleton.days.some((d) => d.transfers.length > 0)).toBe(true)
      expect(skeleton.days.some((d) => d.freeTime.length > 0 || d.notes.length > 0)).toBe(true)
      expect(skeleton.notes.join(' ')).toMatch(/Provider-independent/)

      const turn = runTravelPlanningTurn(
        {
          text: 'to Morocco from Riyadh 2026-10-01 to 2026-10-04 adults 2 beach',
        },
        { enabled: true },
      )
      expect(turn.plan?.itinerary?.days.length).toBeGreaterThan(0)
    })
  })
})
