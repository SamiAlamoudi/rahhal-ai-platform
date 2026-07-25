/**
 * Phase 5 Stage 1 — AI Journey Timeline tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  JOURNEY_EVENT_KINDS,
  JOURNEY_EVENT_STATUSES,
  JOURNEY_LAYOUTS,
  JOURNEY_STEPS,
  JOURNEY_TIMELINE_ARCHITECTURE,
  JOURNEY_TIMELINE_FEATURE_ID,
  JourneyTimeline,
  assertJourneyTimelineIsolation,
  createInitialJourneyTimelineState,
  eventsForLayout,
  isJourneyTimelineEnabled,
  tryRenderJourneyTimeline,
} from '../../ui/journeyTimeline'

describe('Phase 5 Stage 1 — AI Journey Timeline', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.journey_timeline default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(JOURNEY_TIMELINE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(JOURNEY_TIMELINE_FEATURE_ID)).toBe(
        false,
      )
      expect(isJourneyTimelineEnabled()).toBe(false)
      expect(JOURNEY_TIMELINE_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(JOURNEY_TIMELINE_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(JOURNEY_TIMELINE_ARCHITECTURE.wiredIntoBookingApis).toBe(false)
      expect(JOURNEY_TIMELINE_ARCHITECTURE.wiredIntoMapsApis).toBe(false)
      expect(JOURNEY_TIMELINE_ARCHITECTURE.wiredIntoWeatherApis).toBe(false)
      expect(JOURNEY_TIMELINE_ARCHITECTURE.realtime).toBe(false)
      expect(JOURNEY_TIMELINE_ARCHITECTURE.notifications).toBe(false)
      expect(tryRenderJourneyTimeline({})).toBeNull()
      expect(renderToStaticMarkup(createElement(JourneyTimeline))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-jt',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-jt',
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

  describe('inventory + layouts', () => {
    it('exposes steps, statuses, kinds, layouts and isolation', () => {
      expect(JOURNEY_STEPS).toEqual(
        expect.arrayContaining([
          'departure',
          'boarding',
          'flight',
          'hotel',
          'meetings',
          'return',
        ]),
      )
      expect(JOURNEY_EVENT_STATUSES).toEqual(
        expect.arrayContaining([
          'completed',
          'current',
          'upcoming',
          'delayed',
          'cancelled',
          'recommended',
        ]),
      )
      expect(JOURNEY_EVENT_KINDS).toEqual(
        expect.arrayContaining([
          'flight',
          'hotel',
          'weather',
          'currency',
          'maps',
          'meeting',
        ]),
      )
      expect(JOURNEY_LAYOUTS).toEqual([
        'vertical',
        'horizontal',
        'compact',
        'daily',
        'weekly',
      ])
      expect(assertJourneyTimelineIsolation().presentationOnly).toBe(true)
    })

    it('filters events for daily and compact layouts', () => {
      const state = createInitialJourneyTimelineState({ enabled: true })
      const daily = eventsForLayout(state.events, 'daily')
      expect(daily.every((e) => e.dayIndex === 0)).toBe(true)
      const compact = eventsForLayout(state.events, 'compact')
      expect(compact.every((e) => !e.placeholder)).toBe(true)
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders progress, layouts, steps, and event cards including placeholders', () => {
      const html = renderToStaticMarkup(
        createElement(JourneyTimeline, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
          initialState: { layout: 'vertical' },
        }),
      )

      expect(html).toContain('data-testid="journey-timeline"')
      expect(html).toContain('data-testid="jt-progress"')
      expect(html).toContain('data-testid="jt-current-step"')
      expect(html).toContain('data-testid="jt-timeline-board"')
      expect(html).toContain('data-layout="vertical"')
      expect(html).toContain('data-layout="horizontal"')
      expect(html).toContain('data-step="departure"')
      expect(html).toContain('data-step="boarding"')
      expect(html).toContain('data-status="current"')
      expect(html).toContain('data-status="delayed"')
      expect(html).toContain('data-kind="flight"')
      expect(html).toContain('data-kind="weather"')
      expect(html).toContain('data-kind="maps"')
      expect(html).toContain('data-placeholder="true"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('amadeus')
      expect(html).not.toContain('firebase')
    })
  })
})
