/**
 * Integration Sprint 7 — Live Trip Companion tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_TRIP_COMPANION_FEATURE_ID,
  INTEGRATION_TRIP_COMPANION_VERSION,
  TRIP_SESSION_STATES,
  buildCompanionLocationLayer,
  buildEmergencySupport,
  buildTravelTimeline,
  createTripSession,
  detectCompanionAssistantIntent,
  detectCompanionDisruption,
  detectEmergencyKind,
  enrichWithIntegrationTripCompanion,
  isIntegrationTripCompanionEnabled,
  replanTimeline,
  resolveTripSessionState,
  runTripCompanion,
  seedEventsFromPlan,
} from '../agent/integrationTripCompanion'
import { emptyMemory, emptyRequirements, mergeRequirements, withTripPlan } from '../agent'
import { buildTripPlan } from '../agent/buildItinerary'
import type { AgentMemory } from '../agent/types'

function memoryWithPlan(partial?: Partial<ReturnType<typeof emptyRequirements>>): AgentMemory {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Casablanca',
    destinations: ['Casablanca'],
    startDate: '2026-08-01',
    endDate: '2026-08-06',
    durationDays: 5,
    travelers: 2,
    budgetAmount: 8000,
    budgetCurrency: 'SAR',
    budgetStyle: 'midrange',
    tripPurpose: 'leisure',
    interests: ['culture', 'food'],
    ...partial,
  })
  const base = emptyMemory('en')
  const plan = buildTripPlan({
    conversationId: 'companion-test',
    requirements,
    locale: 'en',
  })
  // Ensure at least one timed activity for timeline assertions
  if (plan.dailyItinerary[0] && plan.dailyItinerary[0].activities.length === 0) {
    plan.dailyItinerary[0] = {
      ...plan.dailyItinerary[0],
      activities: [
        { time: '10:00', title: 'Medina walk', description: 'Easy morning stroll' },
        { time: '14:00', title: 'Business meeting', description: 'Client sync' },
        { time: '19:30', title: 'Dinner restaurant', description: 'Reservation' },
      ],
    }
  }
  if (!plan.accommodations.length) {
    plan.accommodations = [{
      name: 'Casa Business Suites',
      area: 'Center',
      category: 'hotel',
      fit: 'Central',
      estimatedNightly: 500,
      currency: 'SAR',
    }]
  }
  if (!plan.flights.length) {
    plan.flights = [{
      from: 'RUH',
      to: 'CMN',
      airline: 'SV',
      stops: 0,
      estimatedCost: 1800,
      currency: 'SAR',
      notes: 'Morning departure',
    }]
  }
  return withTripPlan({ ...base, requirements, missingFields: [] }, plan)
}

describe('Integration Sprint 7 — Live Trip Companion', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps integration trip companion flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_TRIP_COMPANION_FEATURE_ID)).toBe(false)
    expect(isIntegrationTripCompanionEnabled()).toBe(false)
    expect(INTEGRATION_TRIP_COMPANION_VERSION).toMatch(/integration-trip-companion/)
  })

  it('returns disabled result when flag is OFF', async () => {
    const result = await runTripCompanion({
      memory: memoryWithPlan(),
      userText: 'What should I do now?',
    })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('covers full trip session lifecycle states', () => {
    expect(TRIP_SESSION_STATES).toEqual([
      'upcoming',
      'travel_day',
      'in_transit',
      'checked_in',
      'exploring',
      'meeting_mode',
      'returning',
      'completed',
    ])
    const mem = memoryWithPlan()
    expect(resolveTripSessionState({
      plan: mem.tripPlan,
      now: new Date('2026-07-20T10:00:00.000Z'),
    })).toBe('upcoming')
    expect(resolveTripSessionState({
      plan: mem.tripPlan,
      now: new Date('2026-08-01T10:00:00.000Z'),
    })).toBe('travel_day')
    expect(createTripSession({
      plan: mem.tripPlan,
      disruption: 'in transit boarding',
    }).state).toBe('in_transit')
    expect(createTripSession({
      plan: mem.tripPlan,
      disruption: 'checked in at hotel',
    }).state).toBe('checked_in')
    expect(createTripSession({
      plan: mem.tripPlan,
      meetingMode: true,
    }).state).toBe('meeting_mode')
    expect(createTripSession({
      plan: mem.tripPlan,
      disruption: 'returning home',
    }).state).toBe('returning')
    expect(resolveTripSessionState({
      plan: mem.tripPlan,
      now: new Date('2026-08-20T10:00:00.000Z'),
    })).toBe('completed')
  })

  it('builds timeline with current/next/upcoming and remaining time', () => {
    const mem = memoryWithPlan()
    const events = seedEventsFromPlan(mem.tripPlan!)
    expect(events.length).toBeGreaterThan(2)
    const timeline = buildTravelTimeline({
      plan: mem.tripPlan,
      now: new Date('2026-08-01T08:00:00.000Z'),
      events,
    })
    expect(timeline.next || timeline.upcoming.length).toBeTruthy()
    expect(timeline.upcoming.length).toBeGreaterThan(0)
    expect(typeof timeline.remainingTodayMinutes).toBe('number')
  })

  it('detects delay / hotel / meeting / traffic / skip disruptions and replans', () => {
    const mem = memoryWithPlan()
    const events = seedEventsFromPlan(mem.tripPlan!)
    const flightDelay = detectCompanionDisruption('My flight delayed 90 minutes')
    expect(flightDelay?.kind).toBe('flight_delayed')
    const delayed = replanTimeline(events, flightDelay!)
    expect(delayed.events.some((e) => e.status === 'rescheduled')).toBe(true)

    const hotel = detectCompanionDisruption('Hotel unavailable tonight')
    expect(hotel?.kind).toBe('hotel_unavailable')
    expect(replanTimeline(events, hotel!).events.some((e) => /alternative hotel/i.test(e.titleEn))).toBe(true)

    const meeting = detectCompanionDisruption('Meeting changed by 45 minutes')
    expect(meeting?.kind).toBe('meeting_changed')
    expect(replanTimeline(events, meeting!).events.length).toBe(events.length)

    const traffic = detectCompanionDisruption('Traffic delay 30 minutes')
    expect(traffic?.kind).toBe('traffic_delay')

    const skip = detectCompanionDisruption('I skipped the activity')
    expect(skip?.kind).toBe('activity_skipped')
    const skipped = replanTimeline(events, skip!)
    expect(skipped.skippedEventIds.length).toBeGreaterThan(0)
  })

  it('answers travel assistant questions from trip context', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_COMPANION_FEATURE_ID, true)
    expect(detectCompanionAssistantIntent('What should I do now?')).toBe('what_now')
    expect(detectCompanionAssistantIntent('When should I leave?')).toBe('when_leave')
    expect(detectCompanionAssistantIntent('Am I late?')).toBe('am_i_late')
    expect(detectCompanionAssistantIntent('Suggest something nearby.')).toBe('nearby')

    const result = await runTripCompanion({
      memory: memoryWithPlan(),
      userText: 'What should I do now?',
      deps: { enabled: true, now: new Date('2026-08-01T08:00:00.000Z') },
    })
    expect(result.enabled).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.assistantIntent).toBe('what_now')
    expect(result.consultantSummaryEn.length).toBeGreaterThan(10)
    expect(result.context?.currentCity).toBeTruthy()
    expect(result.context?.currentHotel).toBeTruthy()
    expect(result.notifications.length).toBeGreaterThan(0)
  })

  it('prepares location abstraction without live maps', () => {
    const mem = memoryWithPlan()
    const layer = buildCompanionLocationLayer(mem.tripPlan)
    expect(layer.mapsReady).toBe(false)
    expect(layer.nearbyReady).toBe(false)
    expect(layer.walkingRoutesReady).toBe(false)
    expect(layer.city?.coordinates).toBeNull()
    expect(layer.hotel?.labelEn).toBeTruthy()
  })

  it('prepares emergency support framework without live integrations', () => {
    expect(detectEmergencyKind('I lost my passport')).toBe('lost_passport')
    expect(detectEmergencyKind('Need medical help / hospital')).toBe('medical_help')
    const support = buildEmergencySupport('embassy_lookup')
    expect(support.liveIntegration).toBe(false)
    expect(support.stepsEn.length).toBeGreaterThan(0)
    expect(support.contactsAr.length).toBeGreaterThan(0)
  })

  it('soft-enriches memory on replan when flag ON', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_COMPANION_FEATURE_ID, true)
    const memory = memoryWithPlan()
    const enriched = await enrichWithIntegrationTripCompanion({
      memory,
      userText: 'Flight delayed 60 minutes',
      force: true,
      deps: { enabled: true, now: new Date('2026-08-01T07:00:00.000Z') },
    })
    expect(enriched.tripCompanion?.replanned).toBe(true)
    expect(enriched.tripPlan?.notes.some((n) => /replanned|أعاد/i.test(n))).toBe(true)
    expect(enriched.reply).toMatch(/delay|timeline|rebuilt|تأخر|جدول/i)
  })

  it('recovery scenario: skipped activity then ask what now', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_TRIP_COMPANION_FEATURE_ID, true)
    const result = await runTripCompanion({
      memory: memoryWithPlan(),
      userText: 'I skipped the activity — what should I do now?',
      deps: { enabled: true, now: new Date('2026-08-01T11:00:00.000Z') },
    })
    expect(result.replanned || result.assistantIntent === 'what_now').toBe(true)
    expect(result.consultantSummaryEn.length).toBeGreaterThan(10)
  })

  it('regression: enrich is a no-op when flag OFF', async () => {
    const memory = memoryWithPlan()
    const enriched = await enrichWithIntegrationTripCompanion({
      memory,
      userText: 'What should I do now?',
    })
    expect(enriched.tripCompanion).toBeNull()
    expect(enriched.memory).toBe(memory)
  })
})
