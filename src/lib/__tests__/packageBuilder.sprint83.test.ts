/**
 * Sprint 83 — AI Dynamic Travel Packages tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  calculatePackageConfidence,
  checkActivityCompatibility,
  checkFlightHotelCompatibility,
  checkTransferCompatibility,
  dedupePackages,
  evaluateCompatibility,
  explainPackage,
  generatePackageCandidates,
  generatePackageCandidatesParallel,
  onPackageEvent,
  optimizePackagesParallel,
  pruneWeakPackages,
  rankPackages,
  resetPackageEventListeners,
  rerankPackagesWithPreferences,
  runPackageBuilder,
  scorePackage,
  SPRINT83_DYNAMIC_PACKAGES_VERSION,
  type NormalizedActivityOffer,
  type NormalizedFlightOffer,
  type NormalizedHotelOffer,
  type NormalizedTransferOffer,
  type PackageCandidate,
  type PackageEvent,
} from '../../core'
import {
  enrichWithDynamicPackages,
  isDynamicPackagesEnabled,
  normalizeFlightOffers,
  normalizeHotelOffers,
  prioritizeOffersForDecisionEngine,
} from '../agent/packageBuilder'
import type { AgentMemory, TripPlan } from '../agent/types'
import { emptyRequirements } from '../agent/types'

function flight(partial: Partial<NormalizedFlightOffer> & { id: string }): NormalizedFlightOffer {
  return {
    airline: 'Saudia',
    price: 1200,
    currency: 'SAR',
    durationMinutes: 180,
    stops: 0,
    arrivalAt: '2026-08-15T14:00:00.000Z',
    departureAt: '2026-08-15T11:00:00.000Z',
    destination: 'DXB',
    origin: 'RUH',
    cabin: 'economy',
    refundable: true,
    loyaltyMatch: false,
    seatsRemaining: 9,
    providerConfidence: 0.9,
    payload: {},
    ...partial,
  }
}

function hotel(partial: Partial<NormalizedHotelOffer> & { id: string }): NormalizedHotelOffer {
  return {
    name: 'City Hotel',
    price: 1500,
    currency: 'SAR',
    stars: 4,
    rating: 8.2,
    walkMinutes: 12,
    checkIn: '2026-08-15',
    checkOut: '2026-08-20',
    destination: 'DXB',
    familyFriendly: false,
    refundable: true,
    breakfastIncluded: true,
    luxury: false,
    businessFriendly: false,
    providerConfidence: 0.88,
    payload: {},
    ...partial,
  }
}

function transfer(partial: Partial<NormalizedTransferOffer> & { id: string }): NormalizedTransferOffer {
  return {
    title: 'Airport transfer',
    price: 120,
    currency: 'SAR',
    durationMinutes: 35,
    availableFrom: '2026-08-15T00:00:00.000Z',
    availableTo: '2026-08-15T23:59:00.000Z',
    destination: 'DXB',
    providerConfidence: 0.8,
    payload: {},
    ...partial,
  }
}

function activity(partial: Partial<NormalizedActivityOffer> & { id: string }): NormalizedActivityOffer {
  return {
    title: 'Museum tour',
    price: 200,
    currency: 'SAR',
    startAt: '2026-08-16T10:00:00.000Z',
    endAt: '2026-08-16T13:00:00.000Z',
    destination: 'DXB',
    quality: 80,
    familyFriendly: false,
    providerConfidence: 0.8,
    payload: {},
    ...partial,
  }
}

function stubMemory(): AgentMemory {
  return {
    locale: 'en',
    phase: 'planned',
    requirements: {
      ...emptyRequirements(),
      destination: 'Dubai',
      origin: 'Riyadh',
      budgetAmount: 9000,
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
    id: 'p83',
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
      from: 'RUH',
      to: 'DXB',
      airline: 'Saudia',
      stops: 0,
      estimatedCost: 1200,
      currency: 'SAR',
      notes: null,
    }],
    accommodations: [{
      name: 'City Hotel',
      area: 'Marina',
      category: 'hotel',
      fit: 'good',
      estimatedNightly: 400,
      currency: 'SAR',
    }],
    attractions: [],
    weatherNotes: [],
    visaNotes: [],
    travelTips: [],
    packingSuggestions: [],
    estimatedBudget: { amount: 4000, currency: 'SAR', breakdown: [] },
    estimatedCosts: { amount: 4000, currency: 'SAR', breakdown: [] },
    notes: [],
    conversationId: 'c83',
    requirements: emptyRequirements(),
    updatedAt: '2026-07-21T00:00:00.000Z',
  }
}

describe('Sprint 83 — AI Dynamic Travel Packages', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPackageEventListeners()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetPackageEventListeners()
  })

  it('enables ai.dynamic_packages by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.dynamic_packages')).toBe(true)
    expect(isDynamicPackagesEnabled()).toBe(true)
    expect(SPRINT83_DYNAMIC_PACKAGES_VERSION).toMatch(/dynamic-packages/)
  })

  it('generates packages from flight + hotel offers', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' }), flight({ id: 'f2', price: 900, airline: 'Flynas', stops: 1 })],
      hotels: [hotel({ id: 'h1' }), hotel({ id: 'h2', name: 'Budget Inn', price: 700, stars: 2, rating: 6 })],
      maxCandidates: 20,
    })
    expect(result.packages.length).toBeGreaterThan(0)
    expect(result.selected).toBeTruthy()
    expect(result.version).toMatch(/dynamic-packages/)
  })

  it('deduplicates identical package component sets', () => {
    const base = generatePackageCandidates({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1' })],
    })
    const doubled = [...base, ...base.map((p) => ({ ...p, id: `${p.id}_copy` }))]
    const { unique, duplicateCount } = dedupePackages(doubled)
    expect(duplicateCount).toBeGreaterThan(0)
    expect(unique.length).toBeLessThan(doubled.length)
  })

  it('rejects arrival after hotel check-in closes', () => {
    const reasons = checkFlightHotelCompatibility(
      flight({ id: 'f1', arrivalAt: '2026-08-15T23:30:00.000Z' }),
      hotel({ id: 'h1', checkIn: '2026-08-15T18:00:00.000Z' }),
    )
    expect(reasons).toContain('arrival after hotel check-in closes')
  })

  it('rejects invalid destination combinations', () => {
    const reasons = checkFlightHotelCompatibility(
      flight({ id: 'f1', destination: 'CAI' }),
      hotel({ id: 'h1', destination: 'DXB' }),
    )
    expect(reasons).toContain('invalid destination combination')
  })

  it('rejects transfer unavailable windows', () => {
    const reasons = checkTransferCompatibility(
      flight({ id: 'f1', arrivalAt: '2026-08-15T22:00:00.000Z' }),
      hotel({ id: 'h1' }),
      transfer({
        id: 't1',
        availableFrom: '2026-08-15T08:00:00.000Z',
        availableTo: '2026-08-15T12:00:00.000Z',
      }),
    )
    expect(reasons).toContain('transfer unavailable')
  })

  it('rejects airport transfer destination mismatch', () => {
    const reasons = checkTransferCompatibility(
      flight({ id: 'f1' }),
      hotel({ id: 'h1', destination: 'DXB' }),
      transfer({ id: 't1', destination: 'AUH' }),
    )
    expect(reasons).toContain('airport transfer mismatch')
  })

  it('rejects activity outside stay', () => {
    const reasons = checkActivityCompatibility(
      hotel({ id: 'h1', checkIn: '2026-08-15', checkOut: '2026-08-20' }),
      activity({ id: 'a1', startAt: '2026-08-22T10:00:00.000Z', endAt: '2026-08-22T12:00:00.000Z' }),
    )
    expect(reasons).toContain('activity outside stay')
  })

  it('flags activity overlap invalid end before start', () => {
    const reasons = checkActivityCompatibility(
      hotel({ id: 'h1' }),
      activity({
        id: 'a1',
        startAt: '2026-08-16T15:00:00.000Z',
        endAt: '2026-08-16T10:00:00.000Z',
      }),
    )
    expect(reasons).toContain('overlapping reservations')
  })

  it('evaluateCompatibility aggregates rejection reasons', () => {
    const result = evaluateCompatibility({
      flight: flight({ id: 'f1', destination: 'JED' }),
      hotel: hotel({ id: 'h1', destination: 'DXB' }),
      transfer: transfer({ id: 't1', destination: 'AUH' }),
    })
    expect(result.compatible).toBe(false)
    expect(result.rejectionReasons.length).toBeGreaterThan(0)
  })

  it('builds family packages with family suitability', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1', familyFriendly: true, name: 'Family Resort', rating: 8.8 })],
      activities: [activity({ id: 'a1', familyFriendly: true, title: 'Kids park', quality: 90 })],
      travelerType: 'family',
    })
    const family = result.labels.bestFamily ?? result.ranked[0]
    expect(family).toBeTruthy()
    expect(family!.dimensions?.family_suitability).toBeGreaterThanOrEqual(80)
  })

  it('builds luxury packages', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1', cabin: 'business', price: 4000 })],
      hotels: [hotel({
        id: 'h1',
        name: 'Four Seasons',
        stars: 5,
        rating: 9.5,
        luxury: true,
        price: 5000,
        walkMinutes: 5,
      })],
    })
    const lux = result.labels.bestLuxury
    expect(lux).toBeTruthy()
    expect(lux!.dimensions?.luxury_level).toBeGreaterThanOrEqual(80)
  })

  it('builds business packages', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1', cabin: 'business', loyaltyMatch: true, price: 3500 })],
      hotels: [hotel({
        id: 'h1',
        businessFriendly: true,
        name: 'Business Hub',
        stars: 4,
        rating: 8.6,
      })],
      travelerType: 'business',
    })
    expect(result.labels.bestBusiness).toBeTruthy()
    expect(result.labels.bestBusiness!.dimensions?.business_suitability).toBeGreaterThanOrEqual(80)
  })

  it('builds budget packages', async () => {
    const result = await runPackageBuilder({
      flights: [
        flight({ id: 'cheap', airline: 'Flynas', price: 600, stops: 1, durationMinutes: 400, refundable: false }),
        flight({ id: 'pricey', price: 3000 }),
      ],
      hotels: [
        hotel({ id: 'budget', name: 'Budget Inn', price: 400, stars: 2, rating: 6.2, walkMinutes: 40 }),
        hotel({ id: 'lux', name: 'Palace', price: 4500, stars: 5, luxury: true }),
      ],
      budgetCap: 5000,
    })
    expect(result.labels.bestBudget).toBeTruthy()
    expect(result.labels.bestBudget!.totalPrice).toBeLessThanOrEqual(
      result.labels.bestLuxury?.totalPrice ?? Infinity,
    )
  })

  it('ranks with expected labels', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' }), flight({ id: 'f2', price: 800, stops: 1 })],
      hotels: [
        hotel({ id: 'h1', familyFriendly: true }),
        hotel({ id: 'h2', luxury: true, stars: 5, price: 4000, name: 'Luxe' }),
        hotel({ id: 'h3', businessFriendly: true, name: 'Biz' }),
      ],
      isWeekend: true,
    })
    const labelSet = new Set(result.ranked.flatMap((p) => p.labels))
    expect(labelSet.has('best_overall')).toBe(true)
    expect(labelSet.has('best_budget')).toBe(true)
    expect(labelSet.has('best_value')).toBe(true)
  })

  it('computes confidence between 0 and 1', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1', refundable: true })],
      hotels: [hotel({ id: 'h1', refundable: true, breakfastIncluded: true })],
      transfers: [transfer({ id: 't1' })],
      addons: [{
        id: 'ins1',
        kind: 'insurance',
        title: 'Travel insurance',
        price: 80,
        currency: 'SAR',
        providerConfidence: 0.9,
        payload: {},
      }],
    })
    const conf = result.selected?.confidence ?? 0
    expect(conf).toBeGreaterThan(0)
    expect(conf).toBeLessThanOrEqual(1)
    expect(calculatePackageConfidence(result.selected!)).toBeGreaterThan(0.3)
  })

  it('produces lazy explanations for selected packages', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1', stops: 0, refundable: true })],
      hotels: [hotel({
        id: 'h1',
        rating: 9.1,
        breakfastIncluded: true,
        walkMinutes: 8,
        refundable: true,
      })],
      transfers: [transfer({ id: 't1' })],
    })
    expect(result.selected?.explanation).toBeTruthy()
    expect(result.selected!.explanation!).toContain('Recommended because')
    expect(result.selected!.reasons.length).toBeGreaterThan(0)
  })

  it('explainPackage includes direct flight and breakfast bullets', () => {
    const pkg = scorePackage({
      id: 'x',
      title: 't',
      currency: 'SAR',
      totalPrice: 3000,
      components: [
        {
          kind: 'flight',
          id: 'f',
          title: 'Saudia',
          price: 1200,
          currency: 'SAR',
          payload: { stops: 0, refundable: true },
        },
        {
          kind: 'hotel',
          id: 'h',
          title: 'Hilton',
          price: 1800,
          currency: 'SAR',
          payload: {
            rating: 9,
            breakfastIncluded: true,
            walkMinutes: 10,
            refundable: true,
          },
        },
        {
          kind: 'transfer',
          id: 't',
          title: 'Transfer',
          price: 100,
          currency: 'SAR',
          payload: {},
        },
      ],
      destination: 'DXB',
      checkIn: null,
      checkOut: null,
      arrivalAt: null,
      departureAt: null,
      score: 70,
      dimensions: null,
      confidence: 0.7,
      labels: [],
      reasons: [],
      explanation: null,
      compatible: true,
      rejectionReasons: [],
      normalizedKey: 'flight:f|hotel:h',
      providerConfidence: 0.9,
    })
    const explained = explainPackage(pkg, [{ ...pkg, id: 'alt', totalPrice: 4500 }])
    expect(explained.reasons).toContain('Direct flight')
    expect(explained.reasons).toContain('Breakfast included')
    expect(explained.reasons).toContain('Airport transfer included')
    expect(explained.reasons.some((r) => r.startsWith('Saved'))).toBe(true)
    expect(explained.reasons).toContain('Flexible cancellation')
    expect(explained.reasons).toContain('Walking distance to attractions')
  })

  it('generates packages in parallel by flight shard', async () => {
    const started = Date.now()
    const packages = await generatePackageCandidatesParallel({
      flights: [flight({ id: 'f1' }), flight({ id: 'f2', price: 1100 }), flight({ id: 'f3', price: 1300 })],
      hotels: [hotel({ id: 'h1' }), hotel({ id: 'h2', price: 900 })],
    })
    const elapsed = Date.now() - started
    expect(packages.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2000)
  })

  it('filters incompatible packages during optimize', async () => {
    const raw = generatePackageCandidates({
      flights: [flight({ id: 'f1', destination: 'DXB' }), flight({ id: 'bad', destination: 'CAI' })],
      hotels: [hotel({ id: 'h1', destination: 'DXB' })],
    })
    const incompatible = raw.filter((p) => !p.compatible)
    expect(incompatible.length).toBeGreaterThan(0)
    const scored = raw.map((p) => scorePackage(p))
    const { packages } = await optimizePackagesParallel(scored, { keepTop: 10 })
    expect(packages.every((p) => p.compatible)).toBe(true)
  })

  it('prunes weak scores', () => {
    const weak: PackageCandidate = {
      id: 'w',
      title: 'weak',
      currency: 'SAR',
      totalPrice: 9000,
      components: [],
      destination: null,
      checkIn: null,
      checkOut: null,
      arrivalAt: null,
      departureAt: null,
      score: 10,
      dimensions: null,
      confidence: 0.2,
      labels: [],
      reasons: [],
      explanation: null,
      compatible: true,
      rejectionReasons: [],
      normalizedKey: 'w',
      providerConfidence: 0.5,
    }
    const strong = { ...weak, id: 's', score: 80, normalizedKey: 's' }
    const kept = pruneWeakPackages([weak, strong], { minScore: 35 })
    expect(kept.map((p) => p.id)).toEqual(['s'])
  })

  it('scores cancellation flexibility higher when refundable', () => {
    const flexible = scorePackage({
      id: 'flex',
      title: 'flex',
      currency: 'SAR',
      totalPrice: 3000,
      components: [
        {
          kind: 'flight',
          id: 'f',
          title: 'f',
          price: 1000,
          currency: 'SAR',
          payload: { stops: 0, durationMinutes: 180, refundable: true },
        },
        {
          kind: 'hotel',
          id: 'h',
          title: 'h',
          price: 2000,
          currency: 'SAR',
          payload: { stars: 4, rating: 8, walkMinutes: 10, refundable: true },
        },
      ],
      destination: 'DXB',
      checkIn: null,
      checkOut: null,
      arrivalAt: null,
      departureAt: null,
      score: null,
      dimensions: null,
      confidence: 0,
      labels: [],
      reasons: [],
      explanation: null,
      compatible: true,
      rejectionReasons: [],
      normalizedKey: 'flex',
      providerConfidence: 0.9,
    })
    const rigid = scorePackage({
      ...flexible,
      id: 'rigid',
      components: flexible.components.map((c) => ({
        ...c,
        payload: { ...c.payload, refundable: false },
      })),
    })
    expect(flexible.dimensions!.cancellation_flexibility)
      .toBeGreaterThan(rigid.dimensions!.cancellation_flexibility)
  })

  it('emits package lifecycle events', async () => {
    const seen: PackageEvent['name'][] = []
    onPackageEvent((e) => seen.push(e.name))
    await runPackageBuilder({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1' })],
    })
    expect(seen).toContain('package.created')
    expect(seen).toContain('package.scored')
    expect(seen).toContain('package.ranked')
    expect(seen).toContain('package.selected')
  })

  it('adaptive learning biases re-rank packages', () => {
    const a = scorePackage({
      id: 'lux',
      title: 'lux',
      currency: 'SAR',
      totalPrice: 8000,
      components: [
        {
          kind: 'flight', id: 'f', title: 'f', price: 3000, currency: 'SAR',
          payload: { stops: 0, durationMinutes: 180, cabin: 'business' },
        },
        {
          kind: 'hotel', id: 'h', title: 'h', price: 5000, currency: 'SAR',
          payload: { stars: 5, rating: 9.5, luxury: true, walkMinutes: 5 },
        },
      ],
      destination: 'DXB',
      checkIn: null,
      checkOut: null,
      arrivalAt: null,
      departureAt: null,
      score: null,
      dimensions: null,
      confidence: 0.7,
      labels: [],
      reasons: [],
      explanation: null,
      compatible: true,
      rejectionReasons: [],
      normalizedKey: 'lux',
      providerConfidence: 0.9,
    })
    const b = scorePackage({
      ...a,
      id: 'value',
      totalPrice: 2500,
      normalizedKey: 'value',
      components: [
        {
          kind: 'flight', id: 'f2', title: 'f2', price: 800, currency: 'SAR',
          payload: { stops: 1, durationMinutes: 400 },
        },
        {
          kind: 'hotel', id: 'h2', title: 'h2', price: 1700, currency: 'SAR',
          payload: { stars: 3, rating: 7, walkMinutes: 30 },
        },
      ],
    })
    const reranked = rerankPackagesWithPreferences([b, a], { luxury: 1 })
    expect(reranked[0]?.id).toBe('lux')
  })

  it('price timing boost increases scores', () => {
    const base = {
      id: 'p',
      title: 'p',
      currency: 'SAR',
      totalPrice: 3000,
      components: [
        {
          kind: 'flight', id: 'f', title: 'f', price: 1200, currency: 'SAR',
          payload: { stops: 0, durationMinutes: 180 },
        },
        {
          kind: 'hotel', id: 'h', title: 'h', price: 1800, currency: 'SAR',
          payload: { stars: 4, rating: 8, walkMinutes: 12 },
        },
      ],
      destination: 'DXB',
      checkIn: null,
      checkOut: null,
      arrivalAt: null,
      departureAt: null,
      score: null,
      dimensions: null,
      confidence: 0,
      labels: [],
      reasons: [],
      explanation: null,
      compatible: true,
      rejectionReasons: [],
      normalizedKey: 'p',
      providerConfidence: 0.85,
    } satisfies PackageCandidate
    const without = scorePackage(base)
    const withBoost = scorePackage(base, undefined, undefined, 90)
    expect(withBoost.score!).toBeGreaterThan(without.score!)
  })

  it('normalizes raw offers in agent bridge', () => {
    const flights = normalizeFlightOffers([
      { id: 'f1', airline: 'Emirates', price: 1500, currency: 'SAR', stops: 0 },
    ])
    const hotels = normalizeHotelOffers([
      { id: 'h1', name: 'Marriott', total: 2000, hotelStars: 5, breakfastIncluded: true },
    ])
    expect(flights[0]?.airline).toBe('Emirates')
    expect(hotels[0]?.breakfastIncluded).toBe(true)
    expect(hotels[0]?.luxury).toBe(true)
  })

  it('prioritizes Decision Engine offers from ranked packages', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f-late', price: 2000 }), flight({ id: 'f-early', price: 1000 })],
      hotels: [hotel({ id: 'h-a', price: 2000 }), hotel({ id: 'h-b', price: 900 })],
    })
    const prioritized = prioritizeOffersForDecisionEngine({
      packages: result,
      flightOffers: [{ id: 'f-late' }, { id: 'f-early' }],
      hotelStays: [{ id: 'h-a' }, { id: 'h-b' }],
    })
    expect(prioritized.flightOffers[0]?.id).toBeTruthy()
    expect(prioritized.hotelStays[0]?.id).toBeTruthy()
  })

  it('agent enrich attaches package notes when enabled', async () => {
    const { tripPlan, dynamicPackages } = await enrichWithDynamicPackages({
      memory: stubMemory(),
      tripPlan: stubPlan(),
      flightOffers: [
        { id: 'f1', airline: 'Saudia', price: 1100, currency: 'SAR', stops: 0, destination: 'DXB', origin: 'RUH' },
        { id: 'f2', airline: 'Flynas', price: 800, currency: 'SAR', stops: 1, destination: 'DXB', origin: 'RUH' },
      ],
      hotelStays: [
        { id: 'h1', name: 'Hilton', total: 1600, hotelStars: 4, rating: 8.5, walkMinutes: 10, destination: 'DXB', breakfastIncluded: true },
        { id: 'h2', name: 'Inn', total: 700, hotelStars: 2, rating: 6, walkMinutes: 40, destination: 'DXB' },
      ],
      enabled: true,
    })
    expect(dynamicPackages).toBeTruthy()
    expect(tripPlan.notes.some((n) => n.includes('Dynamic package:'))).toBe(true)
  })

  it('agent enrich no-ops when disabled', async () => {
    const { dynamicPackages, tripPlan } = await enrichWithDynamicPackages({
      memory: stubMemory(),
      tripPlan: stubPlan(),
      flightOffers: [{ id: 'f1', price: 1000, airline: 'X' }],
      hotelStays: [{ id: 'h1', total: 1000, name: 'Y' }],
      enabled: false,
    })
    expect(dynamicPackages).toBeNull()
    expect(tripPlan.notes).toHaveLength(0)
  })

  it('includes optional visa-ready addon kind without requiring it', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1' })],
      addons: [{
        id: 'visa1',
        kind: 'visa',
        title: 'Visa assist',
        price: 0,
        currency: 'SAR',
        providerConfidence: 0.6,
        payload: { optional: true },
      }],
    })
    expect(result.packages.some((p) => p.components.some((c) => c.kind === 'visa'))).toBe(true)
  })

  it('includes lounge and esim addon components', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1' })],
      addons: [
        {
          id: 'lounge1', kind: 'lounge', title: 'Lounge', price: 150, currency: 'SAR',
          providerConfidence: 0.8, payload: {},
        },
        {
          id: 'esim1', kind: 'esim', title: 'eSIM', price: 60, currency: 'SAR',
          providerConfidence: 0.8, payload: {},
        },
      ],
    })
    const kinds = new Set(result.packages.flatMap((p) => p.components.map((c) => c.kind)))
    expect(kinds.has('lounge') || kinds.has('esim')).toBe(true)
  })

  it('handles empty offer pools without throwing', async () => {
    const result = await runPackageBuilder({ flights: [], hotels: [] })
    expect(result.packages).toEqual([])
    expect(result.selected).toBeNull()
    expect(result.ranked).toEqual([])
  })

  it('rankPackages assigns best_weekend when weekend flag set', () => {
    const pkgs = [
      scorePackage({
        id: 'a',
        title: 'a',
        currency: 'SAR',
        totalPrice: 3000,
        components: [
          {
            kind: 'flight', id: 'f', title: 'f', price: 1000, currency: 'SAR',
            payload: { stops: 0, durationMinutes: 160 },
          },
          {
            kind: 'hotel', id: 'h', title: 'h', price: 2000, currency: 'SAR',
            payload: { stars: 4, rating: 8.5, walkMinutes: 8 },
          },
        ],
        destination: 'DXB',
        checkIn: null,
        checkOut: null,
        arrivalAt: null,
        departureAt: null,
        score: null,
        dimensions: null,
        confidence: 0.7,
        labels: [],
        reasons: [],
        explanation: null,
        compatible: true,
        rejectionReasons: [],
        normalizedKey: 'a',
        providerConfidence: 0.9,
      }),
    ]
    const { ranked } = rankPackages(pkgs, { isWeekend: true })
    expect(ranked[0]?.labels).toContain('best_weekend')
  })

  it('rejects overlapping hotel check-out before check-in', () => {
    const reasons = checkFlightHotelCompatibility(
      flight({ id: 'f1' }),
      hotel({ id: 'h1', checkIn: '2026-08-20', checkOut: '2026-08-15' }),
    )
    expect(reasons).toContain('overlapping reservations')
  })

  it('flight mismatch against expected destination', () => {
    const result = evaluateCompatibility({
      flight: flight({ id: 'f1', destination: 'DXB' }),
      hotel: hotel({ id: 'h1', destination: 'DXB' }),
      expectedDestination: 'CAI',
    })
    expect(result.rejectionReasons).toContain('flight mismatch')
  })

  it('weekend ranking label present among outputs', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1', walkMinutes: 5 })],
      isWeekend: true,
    })
    expect(result.labels.bestWeekend).toBeTruthy()
  })

  it('best overall differs from empty selection when candidates exist', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1' })],
    })
    expect(result.labels.bestOverall?.id).toBe(result.selected?.id)
  })

  it('insurance addon can attach to packages', async () => {
    const result = await runPackageBuilder({
      flights: [flight({ id: 'f1' })],
      hotels: [hotel({ id: 'h1' })],
      addons: [{
        id: 'ins',
        kind: 'insurance',
        title: 'Insurance',
        price: 99,
        currency: 'SAR',
        providerConfidence: 0.85,
        payload: {},
      }],
    })
    expect(result.packages.some((p) => p.components.some((c) => c.kind === 'insurance'))).toBe(true)
  })

  it('confidence lower for incompatible packages', () => {
    const bad: PackageCandidate = {
      id: 'bad',
      title: 'bad',
      currency: 'SAR',
      totalPrice: 1000,
      components: [],
      destination: null,
      checkIn: null,
      checkOut: null,
      arrivalAt: null,
      departureAt: null,
      score: 50,
      dimensions: null,
      confidence: 0,
      labels: [],
      reasons: [],
      explanation: null,
      compatible: false,
      rejectionReasons: ['flight mismatch'],
      normalizedKey: 'bad',
      providerConfidence: 0.9,
    }
    expect(calculatePackageConfidence(bad)).toBeLessThan(0.3)
  })
})
