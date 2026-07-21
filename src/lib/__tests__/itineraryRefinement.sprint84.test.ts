/**
 * Sprint 84 — Autonomous Itinerary Refinement Engine tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  analyzeTimeWindows,
  balanceActivities,
  detectConflicts,
  detectRefinementChanges,
  generateAlternatives,
  isEarlyFlight,
  onRefinementEvent,
  optimizeSchedule,
  optimizeTransfers,
  planRefinement,
  refinementConfidence,
  resetPreferenceStore,
  resetRefinementEventListeners,
  resolveConstraints,
  runItineraryRefinement,
  SPRINT84_ITINERARY_REFINEMENT_VERSION,
  type PackageCandidate,
  type RefinementEvent,
} from '../../core'
import {
  enrichWithItineraryRefinement,
  isItineraryRefinementEnabled,
} from '../agent/itineraryRefinement'
import type { PackageBuilderResult } from '../agent/packageBuilder'
import type { AgentMemory, TripPlan } from '../agent/types'
import { emptyRequirements } from '../agent/types'

function basePackage(overrides: Partial<PackageCandidate> = {}): PackageCandidate {
  return {
    id: 'pkg_base',
    title: 'Saudia + City Hotel',
    currency: 'SAR',
    totalPrice: 3200,
    components: [
      {
        kind: 'flight',
        id: 'f1',
        title: 'Saudia RUH→DXB',
        price: 1200,
        currency: 'SAR',
        payload: {
          stops: 0,
          durationMinutes: 180,
          departureAt: '2026-08-15T06:00:00.000Z',
          arrivalAt: '2026-08-15T09:00:00.000Z',
          departureHour: 6,
          cabin: 'economy',
          refundable: true,
        },
      },
      {
        kind: 'hotel',
        id: 'h1',
        title: 'City Hotel',
        price: 1800,
        currency: 'SAR',
        payload: {
          stars: 4,
          rating: 8.2,
          walkMinutes: 12,
          checkIn: '2026-08-15',
          checkOut: '2026-08-20',
          breakfastIncluded: true,
          refundable: true,
        },
      },
      {
        kind: 'transfer',
        id: 't1',
        title: 'Airport transfer',
        price: 120,
        currency: 'SAR',
        payload: {
          durationMinutes: 40,
          availableFrom: '2026-08-15T00:00:00.000Z',
          availableTo: '2026-08-15T23:00:00.000Z',
        },
      },
      {
        kind: 'activity',
        id: 'a1',
        title: 'Museum tour',
        price: 80,
        currency: 'SAR',
        payload: {
          startAt: '2026-08-16T10:00:00.000Z',
          endAt: '2026-08-16T12:00:00.000Z',
          quality: 80,
        },
      },
    ],
    destination: 'DXB',
    checkIn: '2026-08-15',
    checkOut: '2026-08-20',
    arrivalAt: '2026-08-15T09:00:00.000Z',
    departureAt: '2026-08-15T06:00:00.000Z',
    score: 72,
    dimensions: null,
    confidence: 0.8,
    labels: ['best_overall'],
    reasons: [],
    explanation: null,
    compatible: true,
    rejectionReasons: [],
    normalizedKey: 'flight:f1|hotel:h1',
    providerConfidence: 0.9,
    ...overrides,
  }
}

function stubMemory(budget = 9000): AgentMemory {
  return {
    locale: 'en',
    phase: 'planned',
    requirements: {
      ...emptyRequirements(),
      destination: 'Dubai',
      budgetAmount: budget,
      budgetCurrency: 'SAR',
      startDate: '2026-08-15',
      travelerType: 'couple',
    },
    missingFields: [],
    tripPlan: null,
    itinerary: null,
    lastIntent: 'plan',
  }
}

function stubPlan(): TripPlan {
  return {
    id: 'p84',
    title: 'Dubai',
    summary: 'Trip',
    locale: 'en',
    destinations: ['Dubai'],
    startDate: '2026-08-15',
    endDate: '2026-08-20',
    durationDays: 5,
    travelers: 2,
    travelerType: 'couple',
    interests: [],
    dailyItinerary: [],
    activities: [],
    transportation: [],
    flights: [{
      from: 'RUH', to: 'DXB', airline: 'Saudia', stops: 0,
      estimatedCost: 1200, currency: 'SAR', notes: null,
    }],
    accommodations: [{
      name: 'City Hotel', area: 'Marina', category: 'hotel', fit: 'good',
      estimatedNightly: 400, currency: 'SAR',
    }],
    attractions: [],
    weatherNotes: [],
    visaNotes: [],
    travelTips: [],
    packingSuggestions: [],
    estimatedBudget: { amount: 3200, currency: 'SAR', breakdown: [] },
    estimatedCosts: { amount: 3200, currency: 'SAR', breakdown: [] },
    notes: [],
    conversationId: 'c84',
    requirements: emptyRequirements(),
    updatedAt: '2026-07-21T00:00:00.000Z',
  }
}

function stubPackages(pkg: PackageCandidate = basePackage()): PackageBuilderResult {
  return {
    version: '1.0.0-dynamic-packages',
    packages: [pkg],
    ranked: [pkg],
    selected: pkg,
    labels: {
      bestOverall: pkg,
      bestBudget: pkg,
      bestBusiness: null,
      bestFamily: null,
      bestLuxury: null,
      bestWeekend: null,
      bestValue: pkg,
    },
    duplicateCount: 0,
    filteredCount: 0,
    events: [],
    durationMs: 1,
  }
}

describe('Sprint 84 — Autonomous Itinerary Refinement Engine', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetRefinementEventListeners()
    resetPreferenceStore()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetRefinementEventListeners()
    resetPreferenceStore()
  })

  it('enables ai.itinerary_refinement by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.itinerary_refinement')).toBe(true)
    expect(isItineraryRefinementEnabled()).toBe(true)
    expect(SPRINT84_ITINERARY_REFINEMENT_VERSION).toMatch(/itinerary-refinement/)
  })

  it('detects budget change from conversation', () => {
    expect(detectRefinementChanges('Budget increased to SAR 12000')).toContain('budget_change')
  })

  it('detects extra day request', () => {
    expect(detectRefinementChanges('I want one more day')).toContain('extra_day')
  })

  it('detects child traveler', () => {
    expect(detectRefinementChanges('I have children')).toContain('child_traveler')
  })

  it('detects luxury upgrade', () => {
    expect(detectRefinementChanges('My wife prefers luxury')).toContain('luxury_upgrade')
  })

  it('detects economy downgrade', () => {
    expect(detectRefinementChanges('Please downgrade to economy cheaper options')).toContain('economy_downgrade')
  })

  it('detects no early flights', () => {
    expect(detectRefinementChanges("I don't want early flights")).toContain('no_early_flights')
  })

  it('detects halal food preference', () => {
    expect(detectRefinementChanges('I need halal restaurants')).toContain('halal_food')
  })

  it('plans impacted kinds without full rebuild intent', () => {
    const plan = planRefinement({ userText: 'I want one more day and luxury hotels' })
    expect(plan.reuseEverythingElse).toBe(true)
    expect(plan.impactedKinds).toContain('hotel')
    expect(plan.changes).toEqual(expect.arrayContaining(['extra_day', 'luxury_upgrade']))
  })

  it('applies budget change incrementally', () => {
    const result = runItineraryRefinement({
      package: basePackage({ totalPrice: 9000, components: basePackage().components.map((c) => (
        c.kind === 'hotel' ? { ...c, price: 6000 } : c
      )) }),
      userText: 'Budget increased but keep us under 5000',
      budgetCap: 5000,
      changes: ['budget_change'],
    })
    expect(result.refined.totalPrice).toBeLessThanOrEqual(5000)
    expect(result.incremental).toBe(true)
    expect(result.reusedComponents.length).toBeGreaterThan(0)
  })

  it('handles extra traveler pricing touch', () => {
    const before = basePackage()
    const result = runItineraryRefinement({
      package: before,
      changes: ['extra_traveler'],
    })
    expect(result.refined.totalPrice).toBeGreaterThan(before.totalPrice)
    expect(result.impactedComponents.length).toBeGreaterThan(0)
  })

  it('marks hotel/activities family-friendly for child traveler', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['child_traveler'],
      hasChildren: true,
    })
    const hotel = result.refined.components.find((c) => c.kind === 'hotel')
    expect(hotel?.payload.familyFriendly).toBe(true)
  })

  it('applies luxury upgrade to hotel', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      userText: 'My wife prefers luxury',
    })
    const hotel = result.refined.components.find((c) => c.kind === 'hotel')
    expect(hotel?.payload.luxury).toBe(true)
    expect(result.learningSignals.some((s) => s.value === 'luxury')).toBe(true)
  })

  it('applies economy downgrade', () => {
    const before = basePackage()
    const result = runItineraryRefinement({
      package: before,
      changes: ['economy_downgrade'],
    })
    expect(result.refined.totalPrice).toBeLessThan(before.totalPrice)
    const flight = result.refined.components.find((c) => c.kind === 'flight')
    expect(flight?.payload.cabin).toBe('economy')
  })

  it('removes activities on activity_remove', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['activity_remove'],
    })
    expect(result.refined.components.every((c) => c.kind !== 'activity')).toBe(true)
  })

  it('adds activity on activity_add', () => {
    const before = basePackage().components.filter((c) => c.kind === 'activity').length
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['activity_add'],
    })
    expect(result.refined.components.filter((c) => c.kind === 'activity').length).toBeGreaterThan(before)
  })

  it('handles weather change with indoor activity', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['weather_change'],
    })
    expect(result.refined.components.some((c) => c.payload.weatherShow === true || c.title.includes('Indoor') || c.payload.weatherSafe === true)).toBe(true)
  })

  it('handles flight change / no early flights', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      userText: "I don't want early flights",
    })
    const flight = result.refined.components.find((c) => c.kind === 'flight')
    expect(flight?.payload.avoidEarly).toBe(true)
    expect(Number(flight?.payload.departureHour)).toBeGreaterThanOrEqual(10)
  })

  it('replaces hotel on hotel_replacement', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['hotel_replacement'],
    })
    const hotel = result.refined.components.find((c) => c.kind === 'hotel')
    expect(hotel?.payload.replaced).toBe(true)
    expect(hotel?.id).toContain('_alt')
  })

  it('detects schedule conflict activity before arrival', () => {
    const pkg = basePackage()
    pkg.components = pkg.components.map((c) => (
      c.id === 'a1'
        ? { ...c, payload: { ...c.payload, startAt: '2026-08-15T07:00:00.000Z' } }
        : c
    ))
    const conflicts = detectConflicts(pkg)
    expect(conflicts.some((c) => c.code === 'activity_before_arrival')).toBe(true)
  })

  it('detects duplicate activity conflict', () => {
    const pkg = basePackage()
    pkg.components.push({
      kind: 'activity',
      id: 'a2',
      title: 'Museum tour',
      price: 80,
      currency: 'SAR',
      payload: { startAt: '2026-08-17T10:00:00.000Z', endAt: '2026-08-17T12:00:00.000Z' },
    })
    expect(detectConflicts(pkg).some((c) => c.code === 'duplicate_activity')).toBe(true)
  })

  it('inserts meeting into schedule', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['meeting_insertion'],
    })
    expect(result.refined.components.some((c) => c.payload.meeting === true)).toBe(true)
  })

  it('handles late arrival refinement', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['late_arrival'],
    })
    const flight = result.refined.components.find((c) => c.kind === 'flight')
    expect(flight?.payload.lateArrival).toBe(true)
  })

  it('handles early departure refinement', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['early_departure'],
    })
    const flight = result.refined.components.find((c) => c.kind === 'flight')
    expect(flight?.payload.earlyDeparture).toBe(true)
  })

  it('replaces restaurant activity', () => {
    const pkg = basePackage()
    pkg.components.push({
      kind: 'activity',
      id: 'rest1',
      title: 'Restaurant night',
      price: 200,
      currency: 'SAR',
      payload: { food: 'mixed', startAt: '2026-08-16T19:00:00.000Z', endAt: '2026-08-16T21:00:00.000Z' },
    })
    const result = runItineraryRefinement({ package: pkg, changes: ['restaurant_replacement'] })
    expect(result.refined.components.some((c) => c.payload.replaced === true)).toBe(true)
  })

  it('applies accessibility constraints', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['accessibility'],
      hardConstraints: { wheelchair: true },
    })
    expect(result.refined.components.some((c) => c.payload.wheelchair === true)).toBe(true)
  })

  it('optimizes transfers to arrival window', () => {
    const { pkg, touchedIds } = optimizeTransfers(basePackage())
    const xfer = pkg.components.find((c) => c.kind === 'transfer')
    expect(xfer?.payload.optimized).toBe(true)
    expect(touchedIds.length).toBeGreaterThan(0)
  })

  it('scores refinement confidence', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['luxury_upgrade'],
    })
    expect(result.confidence).toBeGreaterThan(0.15)
    expect(result.confidence).toBeLessThanOrEqual(0.98)
    expect(refinementConfidence(result.refined, result.conflicts, true)).toBeGreaterThan(0)
  })

  it('performs incremental updates under 20ms typically', () => {
    const samples: number[] = []
    for (let i = 0; i < 5; i += 1) {
      const result = runItineraryRefinement({
        package: basePackage(),
        userText: "I don't want early flights",
      })
      samples.push(result.durationMs)
      expect(result.incremental).toBe(true)
    }
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(avg).toBeLessThan(20)
  })

  it('reuses untouched components on flight-only change', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['no_early_flights'],
    })
    expect(result.reusedComponents).toEqual(expect.arrayContaining(['h1', 'a1']))
    expect(result.impactedComponents).toContain('f1')
  })

  it('builds explanation with what/why/impact/tradeoffs', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      userText: 'Budget increased and add luxury',
    })
    expect(result.explanation.whatChanged.length).toBeGreaterThan(0)
    expect(result.explanation.why.length).toBeGreaterThan(0)
    expect(result.explanation.impact.length).toBeGreaterThan(0)
    expect(result.explanation.tradeoffs.length).toBeGreaterThan(0)
    expect(result.explanation.summary).toMatch(/Confidence/i)
  })

  it('generates alternatives A/B/C when hard conflicts exist', () => {
    const pkg = basePackage()
    pkg.components = pkg.components.map((c) => (
      c.id === 'a1'
        ? { ...c, payload: { ...c.payload, startAt: '2026-08-15T07:00:00.000Z', closed: true } }
        : c
    ))
    const conflicts = detectConflicts(pkg)
    const alts = generateAlternatives({ base: pkg, conflicts })
    expect(alts.map((a) => a.label)).toEqual(['A', 'B', 'C'])
    expect(alts[0]?.pros.length).toBeGreaterThan(0)
    expect(typeof alts[0]?.costDifference).toBe('number')
    expect(alts[0]?.confidence).toBeGreaterThan(0)
  })

  it('detects budget exceeded conflict', () => {
    const conflicts = detectConflicts(basePackage({ totalPrice: 12000 }), { budgetCap: 5000 })
    expect(conflicts.some((c) => c.code === 'budget_exceeded')).toBe(true)
  })

  it('detects long walking distance', () => {
    const pkg = basePackage()
    pkg.components = pkg.components.map((c) => (
      c.kind === 'hotel' ? { ...c, payload: { ...c.payload, walkMinutes: 55 } } : c
    ))
    expect(detectConflicts(pkg).some((c) => c.code === 'long_walking_distance')).toBe(true)
  })

  it('detects overloaded day', () => {
    const pkg = basePackage()
    for (let i = 0; i < 4; i += 1) {
      pkg.components.push({
        kind: 'activity',
        id: `overload_${i}`,
        title: `Act ${i}`,
        price: 50,
        currency: 'SAR',
        payload: {
          startAt: '2026-08-16T0' + (8 + i) + ':00:00.000Z',
          endAt: '2026-08-16T1' + i + ':00:00.000Z',
        },
      })
    }
    expect(detectConflicts(pkg).some((c) => c.code === 'overloaded_day')).toBe(true)
  })

  it('detects impossible transfer', () => {
    const pkg = basePackage()
    pkg.components = pkg.components.map((c) => (
      c.kind === 'transfer'
        ? {
          ...c,
          payload: {
            availableFrom: '2026-08-15T00:00:00.000Z',
            availableTo: '2026-08-15T05:00:00.000Z',
          },
        }
        : c
    ))
    expect(detectConflicts(pkg).some((c) => c.code === 'impossible_transfer')).toBe(true)
  })

  it('detects return flight conflict', () => {
    const pkg = basePackage()
    pkg.components = pkg.components.map((c) => (
      c.kind === 'flight'
        ? { ...c, payload: { ...c.payload, returnDepartureAt: '2026-08-15T08:00:00.000Z' } }
        : c
    ))
    expect(detectConflicts(pkg).some((c) => c.code === 'return_flight_conflict')).toBe(true)
  })

  it('analyzes time windows and early flight flag', () => {
    const pkg = basePackage()
    const windows = analyzeTimeWindows(pkg)
    expect(windows.arrivalAt).toBeTruthy()
    expect(windows.restNeededAfterArrivalMinutes).toBe(90)
    expect(isEarlyFlight(pkg)).toBe(true)
  })

  it('balances activities across days', () => {
    const pkg = basePackage()
    pkg.components.push({
      kind: 'activity',
      id: 'a2',
      title: 'Beach',
      price: 0,
      currency: 'SAR',
      payload: { startAt: '2026-08-16T14:00:00.000Z', endAt: '2026-08-16T16:00:00.000Z' },
    })
    const { pkg: balanced } = balanceActivities(pkg)
    expect(balanced.components.filter((c) => c.kind === 'activity').every((c) => c.payload.balanced === true)).toBe(true)
  })

  it('optimizes schedule timings', () => {
    const { pkg } = optimizeSchedule(basePackage())
    const act = pkg.components.find((c) => c.kind === 'activity')
    expect(act?.payload.scheduleOptimized).toBe(true)
  })

  it('emits refinement lifecycle events', () => {
    const seen: RefinementEvent['name'][] = []
    onRefinementEvent((e) => seen.push(e.name))
    runItineraryRefinement({ package: basePackage(), userText: 'Add luxury please' })
    expect(seen).toContain('refinement.started')
    expect(seen).toContain('refinement.planned')
    expect(seen).toContain('refinement.completed')
  })

  it('resolveConstraints applies soft walking distance', () => {
    const { pkg } = resolveConstraints({
      pkg: basePackage(),
      changes: [],
      soft: { walking_distance: 8 },
    })
    const hotel = pkg.components.find((c) => c.kind === 'hotel')
    expect(Number(hotel?.payload.walkMinutes)).toBeLessThanOrEqual(8)
  })

  it('adds halal restaurant when missing', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      userText: 'I need halal restaurants',
    })
    expect(result.refined.components.some((c) => c.payload.halal === true)).toBe(true)
  })

  it('agent bridge refines and prioritizes offers for Decision Engine', () => {
    const pkg = basePackage()
    const { itineraryRefinement, flightOffers, tripPlan } = enrichWithItineraryRefinement({
      memory: stubMemory(),
      tripPlan: stubPlan(),
      userText: "I don't want early flights",
      dynamicPackages: stubPackages(pkg),
      flightOffers: [{ id: 'f1', price: 1200 }, { id: 'f2', price: 900 }],
      hotelStays: [{ id: 'h1', total: 1800 }, { id: 'h2', total: 900 }],
      learnUserId: 'learn84',
      enabled: true,
    })
    expect(itineraryRefinement).toBeTruthy()
    expect(itineraryRefinement!.incremental).toBe(true)
    expect(flightOffers[0]?.id).toBe('f1')
    expect(tripPlan.notes.some((n) => n.includes('Itinerary refinement:'))).toBe(true)
  })

  it('agent bridge no-ops when disabled', () => {
    const { itineraryRefinement } = enrichWithItineraryRefinement({
      memory: stubMemory(),
      tripPlan: stubPlan(),
      userText: 'luxury please',
      dynamicPackages: stubPackages(),
      enabled: false,
    })
    expect(itineraryRefinement).toBeNull()
  })

  it('feeds learning signals for accepted luxury refinement', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      changes: ['luxury_upgrade'],
      outcome: 'accepted',
    })
    expect(result.learningSignals.some((s) => s.source === 'accepted_recommendation')).toBe(true)
  })

  it('handles closed attraction conflict', () => {
    const pkg = basePackage()
    pkg.components = pkg.components.map((c) => (
      c.kind === 'activity' ? { ...c, payload: { ...c.payload, closed: true } } : c
    ))
    expect(detectConflicts(pkg).some((c) => c.code === 'closed_attraction')).toBe(true)
  })

  it('extra day extends hotel checkout', () => {
    const result = runItineraryRefinement({
      package: basePackage(),
      userText: 'I want one more day',
    })
    const hotel = result.refined.components.find((c) => c.kind === 'hotel')
    expect(hotel?.payload.extraNight).toBe(true)
  })
})
