/**
 * Sprint 93 — Unified Travel Intelligence tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  buildTripAlternatives,
  buildTripTimeline,
  calculateTripCosts,
  combineTripConfidence,
  composeUnifiedTrip,
  deserializeTrip,
  normalizeFlightProviderResult,
  normalizeHotelProviderResult,
  serializeTrip,
  serializeTripSummaryCard,
  validateTrip,
  SPRINT93_UNIFIED_TRIP_VERSION,
} from '../../core'
import {
  isUnifiedTripEnabled,
  runUnifiedTrip,
  UNIFIED_TRIP_FEATURE_ID,
} from '../agent/unifiedTrip'
import { emptyMemory } from '../agent/types'

describe('Sprint 93 — Unified Travel Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai.unified_trip enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.unified_trip')).toBe(true)
    expect(isUnifiedTripEnabled()).toBe(true)
    expect(UNIFIED_TRIP_FEATURE_ID).toBe('ai.unified_trip')
    expect(SPRINT93_UNIFIED_TRIP_VERSION).toMatch(/unified-trip/)
  })

  describe('TripNormalizer adapters', () => {
    it('maps flight and hotel provider results into Trip segments', () => {
      const flight = normalizeFlightProviderResult({
        id: 'f1',
        airline: 'Saudia',
        origin: 'RUH',
        destination: 'DXB',
        price: 1200,
        currency: 'SAR',
        durationMinutes: 190,
        stops: 0,
        cabin: 'ECONOMY',
        providerConfidence: 0.9,
      }, 0)
      expect(flight.direction).toBe('outbound')
      expect(flight.airline).toBe('Saudia')
      expect(flight.price).toBe(1200)

      const hotel = normalizeHotelProviderResult({
        id: 'h1',
        name: 'City Hotel',
        destination: 'Dubai',
        checkIn: '2026-08-15',
        checkOut: '2026-08-20',
        price: 2000,
        currency: 'SAR',
        stars: 4,
      }, 0)
      expect(hotel.nights).toBe(5)
      expect(hotel.name).toBe('City Hotel')
    })
  })

  describe('pricing', () => {
    it('calculates full trip cost breakdown', () => {
      const pricing = calculateTripCosts({
        flights: [
          normalizeFlightProviderResult({ id: 'f1', price: 1000, currency: 'SAR', origin: 'RUH', destination: 'DXB' }, 0),
        ],
        hotel: normalizeHotelProviderResult({ id: 'h1', name: 'H', price: 2000, currency: 'SAR' }, 0),
        transfers: [{
          id: 't1', title: 'Xfer', from: null, to: null, startAt: null,
          durationMinutes: 30, price: 100, currency: 'SAR', providerId: null,
        }],
        activities: [{
          id: 'a1', title: 'Tour', startAt: null, endAt: null,
          price: 200, currency: 'SAR', destination: null, providerId: null,
        }],
        insurance: {
          id: 'i1', title: 'Ins', price: 50, currency: 'SAR', coverage: null, providerId: null,
        },
        visa: {
          id: 'v1', required: false, destination: 'DXB', summary: 'ok',
          estimatedFee: 0, currency: 'SAR', providerId: null,
        },
        currency: 'SAR',
        budgetCap: 4000,
      })
      expect(pricing.flightCost).toBe(1000)
      expect(pricing.hotelCost).toBe(2000)
      expect(pricing.subtotal).toBe(3350)
      expect(pricing.total).toBeGreaterThan(pricing.subtotal)
      expect(pricing.budgetDelta).not.toBeNull()
    })
  })

  describe('timeline', () => {
    it('builds ordered outbound → arrival → hotel → activities → return', () => {
      const timeline = buildTripTimeline({
        flights: [
          normalizeFlightProviderResult({
            id: 'out', origin: 'RUH', destination: 'DXB', price: 1, currency: 'SAR',
            departureAt: '2026-08-15T08:00:00.000Z',
            arrivalAt: '2026-08-15T11:00:00.000Z',
            airline: 'Saudia',
          }, 0, { direction: 'outbound' }),
          normalizeFlightProviderResult({
            id: 'ret', origin: 'DXB', destination: 'RUH', price: 1, currency: 'SAR',
            departureAt: '2026-08-20T18:00:00.000Z',
            arrivalAt: '2026-08-20T21:00:00.000Z',
          }, 1, { direction: 'return' }),
        ],
        hotel: normalizeHotelProviderResult({
          id: 'h1', name: 'City', checkIn: '2026-08-15', checkOut: '2026-08-20',
          price: 1, currency: 'SAR',
        }, 0),
        activities: [{
          id: 'a1', title: 'Museum', startAt: '2026-08-16T10:00:00.000Z',
          endAt: null, price: 0, currency: 'SAR', destination: 'DXB', providerId: null,
        }],
        transfers: [{
          id: 't1', title: 'Airport transfer', from: 'DXB', to: 'Hotel',
          startAt: '2026-08-15T11:30:00.000Z', durationMinutes: 40,
          price: 0, currency: 'SAR', providerId: null,
        }],
      })
      expect(timeline[0]?.kind).toBe('flight_outbound')
      expect(timeline.some((e) => e.kind === 'arrival')).toBe(true)
      expect(timeline.some((e) => e.kind === 'hotel_check_in')).toBe(true)
      expect(timeline.some((e) => e.kind === 'activity')).toBe(true)
      expect(timeline.some((e) => e.kind === 'flight_return')).toBe(true)
    })
  })

  describe('confidence / alternatives / validation / serialization', () => {
    it('combines confidence signals', () => {
      const conf = combineTripConfidence({
        providerConfidence: 0.9,
        priceConfidence: 80,
        decisionConfidence: 0.85,
        packageConfidence: 0.88,
      })
      expect(conf.overall).toBeGreaterThan(0.7)
      expect(conf.reasoning).toMatch(/package|decision/i)
    })

    it('builds cheaper/faster/luxury/balanced alternatives', () => {
      const alts = buildTripAlternatives({
        currency: 'SAR',
        ranked: [
          {
            id: 'p1', title: 'Balanced', currency: 'SAR', totalPrice: 4000,
            confidence: 0.8, explanation: 'balanced', components: [],
            labels: ['best_overall'],
          },
          {
            id: 'p2', title: 'Budget', currency: 'SAR', totalPrice: 2500,
            confidence: 0.7, explanation: 'cheap', components: [],
            labels: ['best_budget'],
          },
          {
            id: 'p3', title: 'Luxury', currency: 'SAR', totalPrice: 9000,
            confidence: 0.75, explanation: 'lux', components: [],
            labels: ['best_luxury'],
          },
        ],
        decision: {
          bestOverallId: 'p1',
          bestBudgetId: 'p2',
          fastestId: 'p1',
          bestComfortId: 'p3',
        },
      })
      expect(alts.some((a) => a.kind === 'cheaper')).toBe(true)
      expect(alts.some((a) => a.kind === 'luxury')).toBe(true)
      expect(alts.some((a) => a.kind === 'balanced')).toBe(true)
      expect(alts.every((a) => a.summary.length > 0)).toBe(true)
    })

    it('rejects missing flights, invalid dates, negative pricing, currency mismatch', () => {
      const missing = validateTrip({
        flights: [],
        hotel: null,
        startDate: '2026-08-15',
        endDate: '2026-08-20',
        pricing: {
          flightCost: 0, hotelCost: 0, transferCost: 0, activityCost: 0,
          insuranceCost: 0, visaCost: 0, estimatedTaxes: 0, estimatedFees: 0,
          subtotal: 0, total: 0, currency: 'SAR', budgetCap: null, budgetDelta: null,
        },
        timeline: [],
        currency: 'SAR',
      })
      expect(missing.ok).toBe(false)
      expect(missing.errors).toContain('Missing flights')

      const badDates = validateTrip({
        flights: [normalizeFlightProviderResult({ id: 'f', price: 1, currency: 'SAR', origin: 'A', destination: 'B' }, 0)],
        hotel: null,
        startDate: '2026-08-20',
        endDate: '2026-08-15',
        pricing: {
          flightCost: 1, hotelCost: 0, transferCost: 0, activityCost: 0,
          insuranceCost: 0, visaCost: 0, estimatedTaxes: 0, estimatedFees: 0,
          subtotal: 1, total: 1, currency: 'SAR', budgetCap: null, budgetDelta: null,
        },
        timeline: [],
        currency: 'SAR',
      })
      expect(badDates.errors).toContain('Invalid dates')

      const negative = validateTrip({
        flights: [normalizeFlightProviderResult({ id: 'f', price: 1, currency: 'SAR', origin: 'A', destination: 'B' }, 0)],
        hotel: null,
        startDate: null,
        endDate: null,
        pricing: {
          flightCost: -10, hotelCost: 0, transferCost: 0, activityCost: 0,
          insuranceCost: 0, visaCost: 0, estimatedTaxes: 0, estimatedFees: 0,
          subtotal: -10, total: -10, currency: 'SAR', budgetCap: null, budgetDelta: null,
        },
        timeline: [],
        currency: 'SAR',
      })
      expect(negative.errors).toContain('Negative pricing')

      const mismatch = validateTrip({
        flights: [normalizeFlightProviderResult({ id: 'f', price: 1, currency: 'USD', origin: 'A', destination: 'B' }, 0)],
        hotel: null,
        startDate: null,
        endDate: null,
        pricing: {
          flightCost: 1, hotelCost: 0, transferCost: 0, activityCost: 0,
          insuranceCost: 0, visaCost: 0, estimatedTaxes: 0, estimatedFees: 0,
          subtotal: 1, total: 1, currency: 'SAR', budgetCap: null, budgetDelta: null,
        },
        timeline: [],
        currency: 'SAR',
      })
      expect(mismatch.errors).toContain('Currency mismatch')
    })

    it('serializes and deserializes trip payloads', () => {
      const result = composeUnifiedTrip({
        destination: 'Dubai',
        origin: 'Riyadh',
        startDate: '2026-08-15',
        endDate: '2026-08-20',
        adults: 2,
        currency: 'SAR',
        flightOffers: [{
          id: 'f1', airline: 'Saudia', origin: 'RUH', destination: 'DXB',
          price: 1200, currency: 'SAR', departureAt: '2026-08-15T08:00:00.000Z',
          arrivalAt: '2026-08-15T11:00:00.000Z',
        }],
        hotelOffers: [{
          id: 'h1', name: 'City Hotel', price: 1800, currency: 'SAR',
          checkIn: '2026-08-15', checkOut: '2026-08-20', destination: 'Dubai',
        }],
        usePlaceholders: true,
      })
      const roundTrip = deserializeTrip(serializeTrip(result.trip))
      expect(roundTrip.id).toBe(result.trip.id)
      expect(serializeTripSummaryCard(result.trip).destination).toBe('Dubai')
    })
  })

  describe('TripComposer end-to-end', () => {
    it('produces one unified Trip with placeholders and summaries', () => {
      const result = composeUnifiedTrip({
        conversationId: 'c93',
        destination: 'Dubai',
        origin: 'Riyadh',
        startDate: '2026-08-15',
        endDate: '2026-08-20',
        durationDays: 5,
        adults: 2,
        budgetCap: 8000,
        currency: 'SAR',
        flightOffers: [{
          id: 'amd-1',
          airline: 'Saudia',
          origin: 'RUH',
          destination: 'DXB',
          price: 1100,
          currency: 'SAR',
          durationMinutes: 190,
          stops: 0,
          departureAt: '2026-08-15T08:00:00.000Z',
          arrivalAt: '2026-08-15T11:10:00.000Z',
          providerId: 'amadeus',
          providerConfidence: 0.9,
        }],
        packageSelected: {
          id: 'pkg1',
          title: 'Saudia + City Hotel',
          currency: 'SAR',
          totalPrice: 3200,
          confidence: 0.84,
          explanation: 'Strong overall package fit.',
          labels: ['best_value'],
          components: [
            {
              kind: 'flight',
              id: 'amd-1',
              title: 'Saudia',
              price: 1100,
              currency: 'SAR',
              payload: { airline: 'Saudia', origin: 'RUH', destination: 'DXB' },
            },
            {
              kind: 'hotel',
              id: 'h1',
              title: 'City Hotel',
              price: 1800,
              currency: 'SAR',
              payload: { name: 'City Hotel', destination: 'Dubai' },
            },
          ],
        },
        packageRanked: [
          {
            id: 'pkg1', title: 'Saudia + City Hotel', currency: 'SAR', totalPrice: 3200,
            confidence: 0.84, explanation: 'value', components: [], labels: ['best_value'],
          },
          {
            id: 'pkg2', title: 'Budget pack', currency: 'SAR', totalPrice: 2400,
            confidence: 0.7, explanation: 'cheap', components: [], labels: ['best_budget'],
          },
        ],
        decision: {
          explanation: 'Best overall fit for Dubai.',
          confidence: 82,
          bestOverallId: 'pkg1',
          bestBudgetId: 'pkg2',
        },
        priceConfidence: 70,
        priceTimingNote: 'Prices look stable.',
        usePlaceholders: true,
      })

      const trip = result.trip
      expect(trip.destination).toBe('Dubai')
      expect(trip.flights.length).toBeGreaterThan(0)
      expect(trip.hotel).toBeTruthy()
      expect(trip.activities.length).toBeGreaterThan(0)
      expect(trip.transfers.length).toBeGreaterThan(0)
      expect(trip.insurance).toBeTruthy()
      expect(trip.visa).toBeTruthy()
      expect(trip.pricingSummary.total).toBeGreaterThan(0)
      expect(trip.timeline.length).toBeGreaterThan(2)
      expect(trip.alternatives.length).toBeGreaterThan(0)
      expect(trip.summary.executive).toMatch(/Dubai/)
      expect(trip.summary.budget).toMatch(/SAR/)
      expect(trip.confidence.overall).toBeGreaterThan(0)
      expect(trip.valid).toBe(true)
      expect(result.serialized).toContain('"destination":"Dubai"')
    })

    it('agent bridge composes from memory + engine outputs and respects flag', () => {
      const memory = emptyMemory('en')
      memory.requirements.destination = 'Dubai'
      memory.requirements.origin = 'Riyadh'
      memory.requirements.startDate = '2026-08-15'
      memory.requirements.endDate = '2026-08-20'
      memory.requirements.travelers = 2
      memory.requirements.budgetAmount = 7000
      memory.requirements.budgetCurrency = 'SAR'

      const response = runUnifiedTrip({
        conversationId: 'bridge-93',
        memory,
        flightOffers: [{
          id: 'f1', airline: 'Saudia', origin: 'RUH', destination: 'DXB',
          price: 1000, currency: 'SAR',
        }],
        hotelOffers: [{
          id: 'h1', name: 'Hotel', price: 1500, currency: 'SAR',
          checkIn: '2026-08-15', checkOut: '2026-08-20',
        }],
      })
      expect(response.enabled).toBe(true)
      expect(response.meta?.tripId).toMatch(/bridge-93/)
      expect(response.result?.trip.flights.length).toBeGreaterThan(0)

      getFeatureRegistry().setEnabled('ai.unified_trip', false)
      const off = runUnifiedTrip({ memory, flightOffers: [{ id: 'f', price: 1, currency: 'SAR', origin: 'A', destination: 'B' }] })
      expect(off.enabled).toBe(false)
      expect(off.result).toBeNull()
    })
  })
})
