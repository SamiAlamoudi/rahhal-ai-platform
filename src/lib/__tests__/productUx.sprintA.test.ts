/**
 * Product Sprint A — New UX/UI Foundation
 */
import { createElement } from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { getFeatureRegistry } from '../ai'
import {
  PRODUCT_UX_SPRINT,
  PRODUCT_UX_VERSION,
  UI_NEW_EXPERIENCE_FEATURE_ID,
  budgetFromBreakdown,
  demoActionConfirmation,
  demoItinerary,
  flightResultFromModel,
  hotelResultFromModel,
  isUiNewExperienceEnabled,
  productCopy,
  productSpacing,
  productTypography,
  PRODUCT_HOME_SUGGESTIONS,
} from '../productUx'
import type { FlightCardModel, HotelCardModel } from '../chat/conversationExperienceUi'
import {
  FlightResultCard,
  HotelResultCard,
  BudgetBreakdownCard,
  ItineraryTimeline,
  ActionConfirmationCard,
  VoiceStateBadge,
  ProductStatePanel,
  BrandMark,
  AuthExperience,
} from '../../components/productUx'

const flight: FlightCardModel = {
  kind: 'flight',
  id: 'f1',
  airline: 'Saudia',
  logoLabel: 'SV',
  departure: 'RUH',
  arrival: 'RAK',
  durationLabel: '5h',
  stops: 0,
  baggage: '23kg',
  refundPolicy: 'Flexible',
  changePolicy: 'Fee',
  fareFamily: 'Economy',
  price: 1400,
  currency: 'SAR',
  loyaltyPoints: 70,
}

const hotel: HotelCardModel = {
  kind: 'hotel',
  id: 'h1',
  name: 'Riad Atlas',
  photos: [],
  mapQuery: 'Riad Atlas',
  stars: 4,
  rating: 8.6,
  reviewsLabel: 'Great',
  roomTypes: ['Family'],
  breakfast: 'Included',
  cancellationPolicy: 'Free 48h',
  refundPolicy: 'Policy',
  loyaltyRewards: '',
  price: 520,
  currency: 'SAR',
  area: 'Medina',
}

describe('Product Sprint A — UX foundation', () => {
  beforeEach(() => {
    getFeatureRegistry().setEnabled(UI_NEW_EXPERIENCE_FEATURE_ID, false)
  })

  it('registers ui.new_experience default OFF', () => {
    expect(UI_NEW_EXPERIENCE_FEATURE_ID).toBe('ui.new_experience')
    expect(getFeatureRegistry().isEnabled('ui.new_experience')).toBe(false)
    expect(isUiNewExperienceEnabled()).toBe(false)
    getFeatureRegistry().setEnabled('ui.new_experience', true)
    expect(isUiNewExperienceEnabled()).toBe(true)
  })

  it('exposes centralized tokens and sprint metadata', () => {
    expect(PRODUCT_UX_SPRINT).toBe('product-sprint-a')
    expect(PRODUCT_UX_VERSION).toMatch(/foundation/)
    expect(productTypography.family.display).toMatch(/Geist/)
    expect(productSpacing.lg).toBe(16)
    expect(PRODUCT_HOME_SUGGESTIONS.length).toBeGreaterThanOrEqual(5)
  })

  it('provides Arabic and English copy', () => {
    expect(productCopy('ar', 'homeHeadline')).toContain('تحتاج')
    expect(productCopy('en', 'homeHeadline').toLowerCase()).toContain('need')
    expect(productCopy('ar', 'chatTitle')).toContain('Bilamo')
  })

  it('maps flight/hotel models with progressive disclosure fields', () => {
    const f = flightResultFromModel(flight, 'ar', 'recommended')
    expect(f.compareTag).toBe('recommended')
    expect(f.reason.length).toBeGreaterThan(5)
    const h = hotelResultFromModel(hotel, 'en')
    expect(h.name).toBe('Riad Atlas')
    expect(h.amenities.length).toBeGreaterThan(0)
  })

  it('presents budget breakdown and itinerary demo data', () => {
    const budget = budgetFromBreakdown(
      {
        currency: 'SAR',
        flights: 2000,
        hotels: 1500,
        transportation: 300,
        meals: 400,
        activities: 200,
        insurance: 0,
        taxes: 100,
        estimatedTotal: 4500,
        reserveHeld: 500,
        withinBudget: true,
        overBy: 0,
        underBy: 500,
      },
      { totalBudget: 5000, locale: 'ar' },
    )
    expect(budget.remaining).toBe(500)
    expect(demoItinerary('ar')[0]?.items.length).toBeGreaterThan(0)
    expect(demoActionConfirmation('en').requiresExplicitConfirm).toBe(true)
  })

  it('creates presentational component trees (RTL + LTR)', () => {
    expect(createElement(BrandMark, { locale: 'ar', withName: true }).type).toBe(BrandMark)
    expect(createElement(BrandMark, { locale: 'en', withName: true }).type).toBe(BrandMark)
    expect(
      createElement(FlightResultCard, { flight: flightResultFromModel(flight, 'ar'), locale: 'ar' })
        .type,
    ).toBe(FlightResultCard)
    expect(
      createElement(HotelResultCard, { hotel: hotelResultFromModel(hotel, 'en'), locale: 'en' }).type,
    ).toBe(HotelResultCard)
    expect(
      createElement(BudgetBreakdownCard, {
        budget: budgetFromBreakdown({
          currency: 'SAR',
          flights: 1,
          hotels: 1,
          transportation: 1,
          meals: 1,
          activities: 1,
          insurance: 0,
          taxes: 0,
          estimatedTotal: 5,
          reserveHeld: 1,
          withinBudget: true,
          overBy: 0,
          underBy: 0,
        }),
        locale: 'ar',
      }).type,
    ).toBe(BudgetBreakdownCard)
    expect(createElement(ItineraryTimeline, { days: demoItinerary('en'), locale: 'en' }).type).toBe(
      ItineraryTimeline,
    )
    expect(
      createElement(ActionConfirmationCard, {
        confirmation: demoActionConfirmation('ar'),
        locale: 'ar',
      }).type,
    ).toBe(ActionConfirmationCard)
    expect(createElement(VoiceStateBadge, { state: 'listening', locale: 'ar' }).type).toBe(
      VoiceStateBadge,
    )
    expect(createElement(ProductStatePanel, { kind: 'offline', locale: 'en' }).type).toBe(
      ProductStatePanel,
    )
    expect(
      createElement(AuthExperience, {
        title: 'Test',
        subtitle: 'Sub',
        children: createElement('div'),
      }).type,
    ).toBe(AuthExperience)
  })
})
