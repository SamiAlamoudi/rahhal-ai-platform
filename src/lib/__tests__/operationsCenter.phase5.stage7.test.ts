/**
 * Phase 5 Stage 7 — Operations Center tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  OPERATIONS_CENTER_ARCHITECTURE,
  OPERATIONS_CENTER_FEATURE_ID,
  OPERATIONS_FILTERS,
  OperationsCenter,
  assertOperationsCenterIsolation,
  createDemoOperationsCenterState,
  isOperationsCenterEnabled,
  tryRenderOperationsCenter,
} from '../../ui/operationsCenter'

describe('Phase 5 Stage 7 — Operations Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.operations_center default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(OPERATIONS_CENTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(
        getFeatureRegistry().isEnabled(OPERATIONS_CENTER_FEATURE_ID),
      ).toBe(false)
      expect(isOperationsCenterEnabled()).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoProductionRoutes).toBe(
        false,
      )
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoRealtime).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoNotifications).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoBookingApis).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoMaps).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.wiredIntoPayments).toBe(false)
      expect(OPERATIONS_CENTER_ARCHITECTURE.authentication).toBe(false)
      expect(tryRenderOperationsCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(OperationsCenter))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-oc',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-oc',
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
      expect(OPERATIONS_FILTERS).toEqual([
        'all',
        'active',
        'delayed',
        'incidents',
        'approvals',
        'visa',
      ])
      expect(assertOperationsCenterIsolation().presentationOnly).toBe(true)
      const demo = createDemoOperationsCenterState({ enabled: true })
      expect(demo.activeTrips.length).toBeGreaterThan(0)
      expect(demo.incidents.length).toBeGreaterThan(0)
      expect(demo.slaMetrics.length).toBeGreaterThan(0)
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders operations sections, queues, incidents, and placeholders', () => {
      const html = renderToStaticMarkup(
        createElement(OperationsCenter, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
        }),
      )

      expect(html).toContain('data-testid="operations-center"')
      expect(html).toContain('data-testid="oc-overview"')
      expect(html).toContain('data-testid="oc-metrics"')
      expect(html).toContain('data-testid="oc-active-trips"')
      expect(html).toContain('data-testid="oc-upcoming-trips"')
      expect(html).toContain('data-testid="oc-delayed-trips"')
      expect(html).toContain('data-testid="oc-traveler-requests"')
      expect(html).toContain('data-testid="oc-traveler-card"')
      expect(html).toContain('data-testid="oc-support-queue"')
      expect(html).toContain('data-testid="oc-queue-card"')
      expect(html).toContain('data-testid="oc-incident-center"')
      expect(html).toContain('data-testid="oc-incident-card"')
      expect(html).toContain('data-testid="oc-emergency-dashboard"')
      expect(html).toContain('data-testid="oc-approval-queue"')
      expect(html).toContain('data-testid="oc-booking-queue"')
      expect(html).toContain('data-testid="oc-visa-queue"')
      expect(html).toContain('data-testid="oc-provider-status"')
      expect(html).toContain('data-testid="oc-provider-card"')
      expect(html).toContain('data-testid="oc-sla-metrics"')
      expect(html).toContain('data-testid="oc-progress-bar"')
      expect(html).toContain('data-testid="oc-agent-workload"')
      expect(html).toContain('data-testid="oc-notifications-queue"')
      expect(html).toContain('data-testid="oc-activity-feed"')
      expect(html).toContain('data-testid="oc-audit-timeline"')
      expect(html).toContain('data-testid="oc-search"')
      expect(html).toContain('data-testid="oc-filters"')
      expect(html).toContain('data-testid="oc-priority-btn"')
      expect(html).toContain('data-testid="oc-risk-btn"')
      expect(html).toContain('data-testid="oc-calendar"')
      expect(html).toContain('data-testid="oc-map"')
      expect(html).toContain('data-testid="oc-charts"')
      expect(html).toContain('data-testid="oc-status-chips"')
      expect(html).toContain('data-filter="all"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('runtime-coordinator')
      expect(html).not.toContain('firebase')
      expect(html).not.toContain('amadeus-live')
    })
  })
})
