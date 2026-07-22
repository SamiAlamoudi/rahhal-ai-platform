/**
 * Sprint 101 — Smart Booking Assistant tests (presentation / orchestration only).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  BookingAssistantComposer,
  composeBookingAssistantExperience,
  buildBookingWarnings,
  buildBookingChecklist,
  buildBookingReadiness,
  SPRINT101_BOOKING_ASSISTANT_VERSION,
  type BookingAssistantComposeInput,
} from '../../core'
import {
  assembleBookingAssistant,
  isBookingAssistantEnabled,
  BOOKING_ASSISTANT_FEATURE_ID,
} from '../agent/bookingAssistant'
import { emptyMemory } from '../agent/types'

function readyInput(overrides?: Partial<BookingAssistantComposeInput>): BookingAssistantComposeInput {
  return {
    conversationId: 'conv_booking_101',
    destination: 'Dubai',
    origin: 'Riyadh',
    startDate: '2026-08-15',
    endDate: '2026-08-20',
    durationDays: 5,
    travelers: 2,
    budgetAmount: 8000,
    budgetCurrency: 'SAR',
    missingFields: [],
    flightSelected: true,
    hotelSelected: true,
    packageSelected: true,
    preferencesApplied: true,
    flight: {
      id: 'flt_1',
      airline: 'Saudia',
      origin: 'RUH',
      destination: 'DXB',
      price: 1200,
      currency: 'SAR',
    },
    hotel: {
      id: 'htl_1',
      name: 'Marina Hotel',
      price: 2200,
      currency: 'SAR',
    },
    packageOffer: {
      id: 'pkg_1',
      title: 'Dubai balanced escape',
      totalPrice: 3600,
      currency: 'SAR',
      confidence: 0.86,
    },
    estimatedTotal: 3600,
    savings: 400,
    currency: 'SAR',
    confidenceScore: 0.86,
    confidenceLevel: 'high',
    confidenceLabel: 'High confidence',
    alpha: {
      enabled: true,
      conversationId: 'conv_booking_101',
      finalRecommendation: 'Dubai balanced escape',
      confidenceLevel: 'high',
      confidenceScore: 0.86,
      nextAction: 'Review the package',
      sectionIds: ['confidence', 'package', 'flight', 'hotel'],
    },
    bookingReadyFromEngine: true,
    ...overrides,
  }
}

describe('Sprint 101 — Smart Booking Assistant', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai.booking_assistant enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.booking_assistant')).toBe(true)
    expect(isBookingAssistantEnabled()).toBe(true)
    expect(BOOKING_ASSISTANT_FEATURE_ID).toBe('ai.booking_assistant')
    expect(SPRINT101_BOOKING_ASSISTANT_VERSION).toMatch(/booking-assistant/)
  })

  describe('readiness', () => {
    it('reports Ready to Book when selections and requirements are complete', () => {
      const readiness = buildBookingReadiness(readyInput())
      expect(readiness.readyToBook).toBe(true)
      expect(readiness.status).toBe('ready_to_book')
      expect(readiness.label).toMatch(/Ready to Book/i)
    })

    it('reports Need Destination Confirmation when destination missing', () => {
      const readiness = buildBookingReadiness(readyInput({
        destination: null,
        bookingReadyFromEngine: false,
      }))
      expect(readiness.status).toBe('need_destination_confirmation')
      expect(readiness.readyToBook).toBe(false)
    })

    it('reports Need Passport only when passport signal exists', () => {
      const readiness = buildBookingReadiness(readyInput({
        passportStatus: 'missing',
      }))
      expect(readiness.status).toBe('need_passport')
    })
  })

  describe('checklist', () => {
    it('marks completed items from existing selections', () => {
      const checklist = buildBookingChecklist(readyInput())
      expect(checklist).not.toBeNull()
      expect(checklist!.items.find((i) => i.id === 'flight_selected')?.complete).toBe(true)
      expect(checklist!.items.find((i) => i.id === 'hotel_selected')?.complete).toBe(true)
      expect(checklist!.items.find((i) => i.id === 'package_selected')?.complete).toBe(true)
      expect(checklist!.items.find((i) => i.id === 'dates_confirmed')?.complete).toBe(true)
      expect(checklist!.completedCount).toBeGreaterThan(0)
    })

    it('hides checklist when no planning signals exist', () => {
      expect(buildBookingChecklist({})).toBeNull()
    })
  })

  describe('warnings', () => {
    it('never invents warnings without supporting data', () => {
      expect(buildBookingWarnings(readyInput({
        priceTimingAction: null,
        priceOpportunities: null,
        priceExplanation: null,
        seatsRemaining: null,
        roomsRemaining: null,
        visaRequiredSignal: null,
        passportStatus: null,
      }))).toBeNull()
    })

    it('emits availability and price warnings only from existing signals', () => {
      const warnings = buildBookingWarnings(readyInput({
        seatsRemaining: 2,
        roomsRemaining: 1,
        priceOpportunities: ['likely_increase'],
        priceTimingAction: 'BOOK_NOW',
        priceExplanation: 'Prices are rising — book soon.',
        visaRequiredSignal: true,
        passportStatus: 'expiring',
        passportExpiresAt: '2026-09-01',
      }))
      expect(warnings).not.toBeNull()
      const kinds = warnings!.items.map((w) => w.kind)
      expect(kinds).toContain('flight_availability_low')
      expect(kinds).toContain('hotel_inventory_limited')
      expect(kinds).toContain('price_likely_increase')
      expect(kinds).toContain('visa_may_be_required')
      expect(kinds).toContain('passport_expiring')
    })
  })

  describe('composer', () => {
    it('assembles a full booking-ready experience', () => {
      const dto = composeBookingAssistantExperience(readyInput({
        seatsRemaining: 4,
        priceOpportunities: ['likely_increase'],
        priceExplanation: 'Book within 48 hours.',
      }))
      expect(dto.enabled).toBe(true)
      expect(dto.version).toBe(SPRINT101_BOOKING_ASSISTANT_VERSION)
      expect(dto.readyToBook).toBe(true)
      expect(dto.readinessStatus).toBe('ready_to_book')
      expect(dto.sectionIds).toContain('readiness')
      expect(dto.sectionIds).toContain('checklist')
      expect(dto.sectionIds).toContain('timeline')
      expect(dto.sectionIds).toContain('warnings')
      expect(dto.sectionIds).toContain('confidence')
      expect(dto.sectionIds).toContain('summary')
      expect(dto.sectionIds).toContain('actions')
      expect(dto.nextAction).toMatch(/booking|payment|Reserve|Proceed/i)
      expect(dto.confidenceScore).toBe(0.86)
      expect(dto.confidenceLevel).toBe('high')

      const summary = dto.sections.find((s) => s.id === 'summary')
      expect(summary && summary.id === 'summary' && summary.estimatedTotal).toBe(3600)
      expect(summary && summary.id === 'summary' && summary.savings).toBe(400)
    })

    it('returns empty sections when disabled', () => {
      const composer = new BookingAssistantComposer()
      const dto = composer.compose(readyInput(), { enabled: false })
      expect(dto.enabled).toBe(false)
      expect(dto.sections).toEqual([])
      expect(dto.readyToBook).toBe(false)
      expect(dto.nextAction).toBeNull()
    })

    it('reuses confidence without inventing a new score', () => {
      const dto = composeBookingAssistantExperience(readyInput({
        confidenceScore: 0.62,
        confidenceLevel: 'medium',
        alpha: {
          enabled: true,
          confidenceScore: 0.62,
          confidenceLevel: 'medium',
          sectionIds: [],
        },
      }))
      expect(dto.confidenceScore).toBe(0.62)
      expect(dto.confidenceLevel).toBe('medium')
    })
  })

  describe('agent bridge', () => {
    it('returns null when flag is off (legacy preserved)', () => {
      getFeatureRegistry().setEnabled('ai.booking_assistant', false)
      expect(isBookingAssistantEnabled()).toBe(false)
      const memory = emptyMemory()
      memory.requirements.destination = 'Dubai'
      const attachment = assembleBookingAssistant({
        memory,
        enabled: false,
        packageSelected: { id: 'pkg_1', title: 'Package', totalPrice: 1000, currency: 'SAR' },
      })
      expect(attachment).toBeNull()
    })

    it('assembles after Alpha-like snapshots', () => {
      const memory = emptyMemory()
      memory.requirements.destination = 'Dubai'
      memory.requirements.origin = 'Riyadh'
      memory.requirements.startDate = '2026-08-15'
      memory.requirements.endDate = '2026-08-20'
      memory.requirements.durationDays = 5
      memory.requirements.travelers = 2
      memory.requirements.budgetAmount = 8000
      memory.requirements.budgetCurrency = 'SAR'
      memory.missingFields = []

      const attachment = assembleBookingAssistant({
        conversationId: 'conv_101',
        memory,
        alphaExperience: {
          version: '1.0.0-alpha-assembly',
          conversationId: 'conv_101',
          enabled: true,
          sections: [],
          sectionIds: ['confidence', 'package', 'flight', 'hotel'],
          finalRecommendation: 'Dubai package',
          confidenceLevel: 'high',
          confidenceScore: 0.9,
          nextAction: 'Confirm booking',
          durationMs: 12,
        },
        packageSelected: {
          id: 'pkg_1',
          title: 'Dubai balanced escape',
          totalPrice: 3600,
          currency: 'SAR',
          confidence: 0.9,
        },
        flightOffers: [{
          id: 'flt_1',
          airline: 'Saudia',
          origin: 'RUH',
          destination: 'DXB',
          price: 1200,
          currency: 'SAR',
          seatsRemaining: 3,
        }],
        hotelOffers: [{
          id: 'htl_1',
          name: 'Marina Hotel',
          price: 2200,
          currency: 'SAR',
        }],
        priceTimingAction: 'BOOK_NOW',
        priceOpportunities: ['likely_increase'],
        priceExplanation: 'Book soon.',
        bookingReadyFromEngine: true,
        engineConfidence: 0.9,
      })

      expect(attachment).not.toBeNull()
      expect(attachment!.meta.enabled).toBe(true)
      expect(attachment!.meta.readyToBook).toBe(true)
      expect(attachment!.experience.sectionIds).toContain('readiness')
      expect(attachment!.experience.sectionIds).toContain('summary')
      expect(attachment!.experience.sections.some((s) => s.id === 'warnings')).toBe(true)
    })
  })
})
