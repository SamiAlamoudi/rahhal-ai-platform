/**
 * Phase 5 Stage 6 — Booking Hub tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  BOOKING_FILTERS,
  BOOKING_HUB_ARCHITECTURE,
  BOOKING_HUB_FEATURE_ID,
  BookingHub,
  assertBookingHubIsolation,
  createDemoBookingHubState,
  isBookingHubEnabled,
  tryRenderBookingHub,
} from '../../ui/bookingHub'

describe('Phase 5 Stage 6 — Booking Hub', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.booking_hub default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(BOOKING_HUB_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(BOOKING_HUB_FEATURE_ID)).toBe(false)
      expect(isBookingHubEnabled()).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoBookingApis).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoAmadeus).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoPayments).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoMaps).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoRealtime).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoNotifications).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(BOOKING_HUB_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(tryRenderBookingHub({})).toBeNull()
      expect(renderToStaticMarkup(createElement(BookingHub))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-bh',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-bh',
            role: 'user',
            modality: 'text',
            content: 'Hello',
            audioUrl: null,
            imageUrl: null,
            attachments: [],
            status: 'complete',
            error: null,
            providerMeta: {},
            createdAt: '2026-07-24T00:00:00.000Z',
            updatedAt: '2026-07-24T00:00:00.000Z',
          },
        ],
      })
      expect(turn.reply.length).toBeGreaterThan(0)
      expect(turn.meta.experience).toBeUndefined()
    })
  })

  describe('inventory', () => {
    it('exposes filters and demo presentation data', () => {
      expect(BOOKING_FILTERS).toEqual([
        'all',
        'upcoming',
        'past',
        'flights',
        'hotels',
        'transport',
      ])
      expect(assertBookingHubIsolation().presentationOnly).toBe(true)
      const demo = createDemoBookingHubState({ enabled: true })
      expect(demo.upcomingTrips.length).toBeGreaterThan(0)
      expect(demo.flights.length).toBeGreaterThan(0)
      expect(demo.priceBreakdown.length).toBeGreaterThan(0)
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders booking sections, services, documents, and placeholders', () => {
      const html = renderToStaticMarkup(
        createElement(BookingHub, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
        }),
      )

      expect(html).toContain('data-testid="booking-hub"')
      expect(html).toContain('data-testid="bh-overview"')
      expect(html).toContain('data-testid="bh-upcoming-trips"')
      expect(html).toContain('data-testid="bh-past-trips"')
      expect(html).toContain('data-testid="bh-flights"')
      expect(html).toContain('data-testid="bh-hotels"')
      expect(html).toContain('data-testid="bh-transportation"')
      expect(html).toContain('data-testid="bh-cruises"')
      expect(html).toContain('data-testid="bh-trains"')
      expect(html).toContain('data-testid="bh-activities"')
      expect(html).toContain('data-testid="bh-restaurants"')
      expect(html).toContain('data-testid="bh-events"')
      expect(html).toContain('data-testid="bh-insurance"')
      expect(html).toContain('data-testid="bh-visa-status"')
      expect(html).toContain('data-testid="bh-documents"')
      expect(html).toContain('data-testid="bh-tickets"')
      expect(html).toContain('data-testid="bh-invoices"')
      expect(html).toContain('data-testid="bh-refunds"')
      expect(html).toContain('data-testid="bh-payment-summary"')
      expect(html).toContain('data-testid="bh-traveler-assignment"')
      expect(html).toContain('data-testid="bh-booking-timeline"')
      expect(html).toContain('data-testid="bh-price-breakdown"')
      expect(html).toContain('data-testid="bh-providers"')
      expect(html).toContain('data-testid="bh-provider-card"')
      expect(html).toContain('data-testid="bh-calendar"')
      expect(html).toContain('data-testid="bh-map"')
      expect(html).toContain('data-testid="bh-search"')
      expect(html).toContain('data-testid="bh-filters"')
      expect(html).toContain('data-testid="bh-favorites"')
      expect(html).toContain('data-testid="bh-bookmarks"')
      expect(html).toContain('data-filter="all"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('amadeus')
      expect(html).not.toContain('stripe')
      expect(html).not.toContain('firebase')
    })
  })
})
