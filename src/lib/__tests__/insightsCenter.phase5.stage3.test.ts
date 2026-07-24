/**
 * Phase 5 Stage 3 — AI Insights Center tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  INSIGHTS_CENTER_ARCHITECTURE,
  INSIGHTS_CENTER_FEATURE_ID,
  INSIGHTS_FILTERS,
  InsightsCenter,
  assertInsightsCenterIsolation,
  createDemoInsightsCenterState,
  isInsightsCenterEnabled,
  tryRenderInsightsCenter,
} from '../../ui/insightsCenter'

describe('Phase 5 Stage 3 — AI Insights Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.insights_center default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(INSIGHTS_CENTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(INSIGHTS_CENTER_FEATURE_ID)).toBe(
        false,
      )
      expect(isInsightsCenterEnabled()).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.wiredIntoBooking).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.wiredIntoMaps).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.wiredIntoWeather).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.wiredIntoNotifications).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.analyticsEngine).toBe(false)
      expect(INSIGHTS_CENTER_ARCHITECTURE.aiReasoning).toBe(false)
      expect(tryRenderInsightsCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(InsightsCenter))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-ic',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-ic',
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
      expect(INSIGHTS_FILTERS).toEqual([
        'this_trip',
        'this_month',
        'this_year',
        'lifetime',
        'business',
        'personal',
      ])
      expect(assertInsightsCenterIsolation().presentationOnly).toBe(true)
      const demo = createDemoInsightsCenterState({ enabled: true })
      expect(demo.statistics.length).toBeGreaterThan(0)
      expect(demo.costBreakdown.length).toBeGreaterThan(0)
      expect(demo.travelHealthScore).toBeGreaterThan(0)
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders overview, stats, budget, places, health, and placeholders', () => {
      const html = renderToStaticMarkup(
        createElement(InsightsCenter, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
        }),
      )

      expect(html).toContain('data-testid="insights-center"')
      expect(html).toContain('data-testid="ic-overview"')
      expect(html).toContain('data-testid="ic-statistics"')
      expect(html).toContain('data-testid="ic-budget"')
      expect(html).toContain('data-testid="ic-cost-breakdown"')
      expect(html).toContain('data-testid="ic-savings"')
      expect(html).toContain('data-testid="ic-countries"')
      expect(html).toContain('data-testid="ic-cities"')
      expect(html).toContain('data-testid="ic-airlines"')
      expect(html).toContain('data-testid="ic-hotels"')
      expect(html).toContain('data-testid="ic-health-score"')
      expect(html).toContain('data-testid="ic-upcoming"')
      expect(html).toContain('data-testid="ic-completed"')
      expect(html).toContain('data-testid="ic-cancelled"')
      expect(html).toContain('data-testid="ic-passport"')
      expect(html).toContain('data-testid="ic-visa"')
      expect(html).toContain('data-testid="ic-loyalty"')
      expect(html).toContain('data-testid="ic-carbon"')
      expect(html).toContain('data-testid="ic-heatmap"')
      expect(html).toContain('data-testid="ic-badges"')
      expect(html).toContain('data-filter="this_year"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('analytics-engine')
      expect(html).not.toContain('amadeus')
    })
  })
})
