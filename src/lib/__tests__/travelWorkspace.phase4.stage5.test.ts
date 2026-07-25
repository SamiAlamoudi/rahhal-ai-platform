/**
 * Phase 4 Stage 5 — Premium Travel Workspace tests.
 * New tests only. Workspace is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  QUICK_ACTIONS,
  TRAVEL_CARD_KINDS,
  TRAVEL_WORKSPACE_ARCHITECTURE,
  TRAVEL_WORKSPACE_FEATURE_ID,
  TRIP_PROGRESS_PHASES,
  TravelWorkspace,
  assertTravelWorkspaceIsolation,
  createDemoTravelWorkspaceState,
  isTravelWorkspaceEnabled,
  tryRenderTravelWorkspace,
} from '../../ui/travelWorkspace'

describe('Phase 4 Stage 5 — Premium Travel Workspace', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.travel_workspace default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(TRAVEL_WORKSPACE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(TRAVEL_WORKSPACE_FEATURE_ID)).toBe(false)
      expect(isTravelWorkspaceEnabled()).toBe(false)
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.presentationOnly).toBe(true)
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.amadeus).toBe(false)
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.payments).toBe(false)
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.wiredIntoConversationCenter).toBe(false)
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.wiredIntoVoiceCenter).toBe(false)
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.wiredIntoKnowledgeCenter).toBe(false)
      expect(tryRenderTravelWorkspace({})).toBeNull()
      expect(renderToStaticMarkup(createElement(TravelWorkspace))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-tw',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-tw',
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

  describe('isolation rules', () => {
    it('keeps workspace presentation-only and disconnected from engines/centers', () => {
      const isolation = assertTravelWorkspaceIsolation()
      expect(isolation.ownDestination).toBe(true)
      expect(isolation.presentationOnly).toBe(true)
      expect(isolation.wiredIntoAi).toBe(false)
      expect(isolation.wiredIntoPlanning).toBe(false)
      expect(isolation.wiredIntoRuntimeCoordinator).toBe(false)
      expect(isolation.wiredIntoConversationOrchestrator).toBe(false)
      expect(isolation.bookingProviders).toBe(false)
      expect(isolation.apis).toBe(false)
    })
  })

  describe('architecture inventory', () => {
    it('exposes required modules, card kinds, progress phases, quick actions', () => {
      expect(TRAVEL_WORKSPACE_ARCHITECTURE.modules).toEqual(
        expect.arrayContaining([
          'dashboard',
          'tripTimeline',
          'flightCards',
          'hotelCards',
          'documentsPanel',
          'quickActions',
          'mapPreview',
          'checklists',
        ]),
      )
      expect(TRAVEL_CARD_KINDS).toEqual(
        expect.arrayContaining([
          'flight',
          'hotel',
          'transport',
          'meeting',
          'activity',
          'ticket',
          'qr',
          'boarding_pass',
        ]),
      )
      expect(TRIP_PROGRESS_PHASES).toEqual([
        'preparation',
        'travel',
        'arrival',
        'meetings',
        'activities',
        'return',
        'completed',
      ])
      expect(QUICK_ACTIONS).toEqual(
        expect.arrayContaining([
          'open_chat',
          'open_voice',
          'open_knowledge',
          'export_pdf',
        ]),
      )
      expect(createDemoTravelWorkspaceState({ enabled: true }).cards.length).toBeGreaterThan(
        0,
      )
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders dashboard, timeline, cards, documents, and quick actions', () => {
      const html = renderToStaticMarkup(
        createElement(TravelWorkspace, { enabled: true, locale: 'ar', theme: 'light' }),
      )

      expect(html).toContain('data-testid="travel-workspace"')
      expect(html).toContain('data-theme="light"')
      expect(html).toContain('data-testid="tw-dashboard"')
      expect(html).toContain('data-testid="tw-trip-overview"')
      expect(html).toContain('data-testid="tw-trip-timeline"')
      expect(html).toContain('data-testid="tw-trip-progress"')
      expect(html).toContain('data-testid="tw-traveler-list"')
      expect(html).toContain('data-testid="tw-documents-panel"')
      expect(html).toContain('data-testid="tw-flight-cards"')
      expect(html).toContain('data-testid="tw-hotel-cards"')
      expect(html).toContain('data-testid="tw-quick-actions"')
      expect(html).toContain('data-quick-action="open_chat"')
      expect(html).toContain('data-quick-action="open_voice"')
      expect(html).toContain('data-quick-action="open_knowledge"')
      expect(html).toContain('data-testid="tw-weather-panel"')
      expect(html).toContain('data-testid="tw-visa-panel"')
      expect(html).toContain('data-testid="tw-currency-panel"')
      expect(html).toContain('data-testid="tw-map-preview"')
      expect(html).toContain('data-testid="tw-emergency-contacts"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('data-testid="conversation-center"')
      expect(html).not.toContain('data-testid="voice-center"')
      expect(html).not.toContain('data-testid="knowledge-center"')
      expect(html).not.toContain('amadeus')
    })
  })
})
