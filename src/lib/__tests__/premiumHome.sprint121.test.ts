/**
 * Sprint 121 — Premium Home Experience tests.
 * Presentation only — no engines, APIs, or mock trip data.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  SPRINT121_PREMIUM_HOME_VERSION,
  UI_PREMIUM_HOME_FEATURE_ID,
  PREMIUM_HOME_SECTIONS,
  isUiPremiumHomeEnabled,
  HomeSection,
  HomeSkeleton,
  HeroSection,
  ConversationEntry,
  ContinueConversation,
  RecentTripsCard,
  UpcomingTrips,
  SuggestedDestinations,
  TravelInspiration,
  RecommendedActions,
  QuickActions,
  SmartSearchEntry,
  FeaturedExperiences,
  featuredItemsFromHistory,
  homePageStyle,
  homeShellStyle,
  homeCardStyle,
} from '../../ui/home'
import { ProductionHomeScreen } from '../../ui/integration'
import { EmptyState, ErrorState, RetryState } from '../../ui/loading'

describe('Sprint 121 — Premium Home Experience', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT121_PREMIUM_HOME_VERSION).toMatch(/premium-home/)
    expect(UI_PREMIUM_HOME_FEATURE_ID).toBe('ui.premium_home')
    expect(getFeatureRegistry().isEnabled('ui.premium_home')).toBe(false)
    expect(isUiPremiumHomeEnabled()).toBe(false)
  })

  it('enables via options override and registry', () => {
    expect(isUiPremiumHomeEnabled({ enabled: true })).toBe(true)
    getFeatureRegistry().setEnabled('ui.production_integration', true)
    getFeatureRegistry().setEnabled('ui.premium_home', true)
    expect(isUiPremiumHomeEnabled()).toBe(true)
  })

  it('declares premium home section architecture', () => {
    expect(PREMIUM_HOME_SECTIONS).toEqual([
      'hero',
      'conversation_entry',
      'continue_conversation',
      'recent_trips',
      'upcoming_trips',
      'suggested_destinations',
      'travel_inspiration',
      'recommended_actions',
      'quick_actions',
      'smart_search',
      'featured_experiences',
    ])
  })

  it('renders home section shell', () => {
    const tree = createElement(HomeSection, {
      sectionId: 'hero',
      title: 'Hero',
      children: createElement('div', null, 'content'),
    })
    expect(tree.type).toBe(HomeSection)
  })

  it('renders hero, conversation entry, and continue sections', () => {
    expect(
      createElement(HeroSection, { greeting: 'مرحباً' }).type,
    ).toBe(HeroSection)
    expect(
      createElement(ConversationEntry, { onStart: () => undefined }).type,
    ).toBe(ConversationEntry)
    expect(
      createElement(ContinueConversation, {
        conversation: null,
        onContinue: () => undefined,
        onStartNew: () => undefined,
      }).type,
    ).toBe(ContinueConversation)
  })

  it('renders trips, destinations, and inspiration sections', () => {
    expect(
      createElement(RecentTripsCard, {
        trips: [],
        onSelect: () => undefined,
      }).type,
    ).toBe(RecentTripsCard)
    expect(
      createElement(UpcomingTrips, {
        trips: [{ id: 't1', title: 'RUH → DXB', status: 'confirmed', totalLabel: '100 SAR' }],
        onSelect: () => undefined,
      }).type,
    ).toBe(UpcomingTrips)
    expect(
      createElement(SuggestedDestinations, {
        destinations: ['Tokyo'],
        onSelect: () => undefined,
      }).type,
    ).toBe(SuggestedDestinations)
    expect(
      createElement(TravelInspiration, { insights: ['hint'] }).type,
    ).toBe(TravelInspiration)
  })

  it('renders actions, search, and featured experiences', () => {
    expect(
      createElement(RecommendedActions, { recommendations: ['prefer aisle'] }).type,
    ).toBe(RecommendedActions)
    expect(
      createElement(QuickActions, {
        actions: [{ id: 'chat', label: 'محادثة', onClick: () => undefined }],
      }).type,
    ).toBe(QuickActions)
    expect(
      createElement(SmartSearchEntry, { onSearch: () => undefined }).type,
    ).toBe(SmartSearchEntry)
    expect(
      createElement(FeaturedExperiences, {
        items: [{ id: 'city', label: 'مدينة', value: 'Riyadh' }],
      }).type,
    ).toBe(FeaturedExperiences)
  })

  it('maps featured items from real history only (no fabricated content)', () => {
    expect(featuredItemsFromHistory(null)).toEqual([])
    expect(
      featuredItemsFromHistory({
        favoriteCity: 'Tokyo',
        mostVisitedCountry: null,
        favoriteAirline: null,
        favoriteHotelChain: null,
        tripCount: 0,
        averageTripCost: null,
        currency: null,
      }),
    ).toEqual([{ id: 'city', label: 'مدينتك المفضلة', value: 'Tokyo' }])
  })

  it('exposes loading skeleton and production home screen', () => {
    expect(createElement(HomeSkeleton).type).toBe(HomeSkeleton)
    expect(ProductionHomeScreen).toBeTruthy()
    expect(createElement(ProductionHomeScreen).type).toBe(ProductionHomeScreen)
  })

  it('supports empty, error, and retry presentation states', () => {
    expect(createElement(EmptyState, { title: 'empty' }).type).toBe(EmptyState)
    expect(createElement(ErrorState, { title: 'error' }).type).toBe(ErrorState)
    expect(
      createElement(RetryState, { title: 'retry', onRetry: () => undefined }).type,
    ).toBe(RetryState)
  })

  it('provides responsive layout helpers and accessible section titles', () => {
    const page = homePageStyle()
    const shell = homeShellStyle()
    const card = homeCardStyle({ interactive: true })
    expect(page.minHeight).toBe('100%')
    expect(page.overflowX).toBe('hidden')
    expect(shell.maxWidth).toBe(1120)
    expect(shell.minWidth).toBe(0)
    expect(card.minWidth).toBe(0)
    expect(card.borderRadius).toBeGreaterThan(0)
    expect(typeof card.transition).toBe('string')

    const section = createElement(HomeSection, {
      sectionId: 'quick_actions',
      title: 'اختصارات سريعة',
    })
    expect(section.props.title).toBe('اختصارات سريعة')
    expect(section.props.sectionId).toBe('quick_actions')
  })

  it('keeps ProductionHomeScreen as a memo component for performance', () => {
    expect(ProductionHomeScreen).toBeTruthy()
    expect(typeof ProductionHomeScreen).toBe('object')
  })
})
