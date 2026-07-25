/**
 * Phase 4 Stage 6 — Executive Dashboard + Notification Center tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  ACTION_CARDS,
  DASHBOARD_FILTERS,
  EXECUTIVE_DASHBOARD_ARCHITECTURE,
  EXECUTIVE_DASHBOARD_FEATURE_ID,
  ExecutiveDashboard,
  assertExecutiveDashboardIsolation,
  createDemoExecutiveDashboardState,
  filterNotifications,
  isExecutiveDashboardEnabled,
  tryRenderExecutiveDashboard,
} from '../../ui/executiveDashboard'

describe('Phase 4 Stage 6 — Executive Dashboard + Notification Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.executive_dashboard default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(EXECUTIVE_DASHBOARD_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(EXECUTIVE_DASHBOARD_FEATURE_ID)).toBe(
        false,
      )
      expect(isExecutiveDashboardEnabled()).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.pushNotifications).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.realtime).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.firebase).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.wiredIntoChat).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.wiredIntoVoice).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.wiredIntoKnowledge).toBe(false)
      expect(EXECUTIVE_DASHBOARD_ARCHITECTURE.wiredIntoBooking).toBe(false)
      expect(tryRenderExecutiveDashboard({})).toBeNull()
      expect(renderToStaticMarkup(createElement(ExecutiveDashboard))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-ed',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-ed',
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

  describe('isolation + inventory', () => {
    it('asserts presentation-only isolation and required filters/actions', () => {
      const isolation = assertExecutiveDashboardIsolation()
      expect(isolation.presentationOnly).toBe(true)
      expect(isolation.apiCalls).toBe(false)
      expect(isolation.calendarSync).toBe(false)
      expect(isolation.aiDecisions).toBe(false)
      expect(DASHBOARD_FILTERS).toEqual(
        expect.arrayContaining(['today', 'trips', 'flights', 'documents']),
      )
      expect(ACTION_CARDS).toEqual(
        expect.arrayContaining([
          'view_trip',
          'open_timeline',
          'open_calendar',
        ]),
      )
    })

    it('filters notifications by read state and category', () => {
      const state = createDemoExecutiveDashboardState({ enabled: true })
      expect(
        filterNotifications(state.notifications, { readState: 'unread' }).every(
          (n) => n.readState === 'unread',
        ),
      ).toBe(true)
      expect(
        filterNotifications(state.notifications, {
          category: 'flight_changes',
        }).map((n) => n.id),
      ).toEqual(['n1'])
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders dashboard panels, widgets, calendar, and notification center', () => {
      const html = renderToStaticMarkup(
        createElement(ExecutiveDashboard, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
        }),
      )

      expect(html).toContain('data-testid="executive-dashboard"')
      expect(html).toContain('data-theme="light"')
      expect(html).toContain('data-testid="ed-metrics"')
      expect(html).toContain('data-testid="ed-filters"')
      expect(html).toContain('data-testid="ed-dashboard-panels"')
      expect(html).toContain('data-testid="ed-upcoming-trips"')
      expect(html).toContain('data-testid="ed-board-meetings"')
      expect(html).toContain('data-testid="ed-notification-center"')
      expect(html).toContain('data-testid="ed-notification-timeline"')
      expect(html).toContain('data-priority="critical"')
      expect(html).toContain('data-category="weather"')
      expect(html).toContain('data-category="visa"')
      expect(html).toContain('data-testid="ed-widgets"')
      expect(html).toContain('data-testid="ed-widget-progress-ring"')
      expect(html).toContain('data-testid="ed-calendar"')
      expect(html).toContain('data-calendar-view="weekly"')
      expect(html).toContain('data-testid="ed-global-search"')
      expect(html).toContain('data-action="view_trip"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('data-testid="conversation-center"')
      expect(html).not.toContain('data-testid="voice-center"')
      expect(html).not.toContain('data-testid="knowledge-center"')
      expect(html).not.toContain('firebase')
    })
  })
})
