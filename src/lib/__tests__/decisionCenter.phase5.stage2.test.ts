/**
 * Phase 5 Stage 2 — AI Decision Center tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  DECISION_CENTER_ARCHITECTURE,
  DECISION_CENTER_FEATURE_ID,
  DECISION_STATE_TAGS,
  DECISION_TYPES,
  DecisionCenter,
  assertDecisionCenterIsolation,
  createDemoDecisionCenterState,
  isDecisionCenterEnabled,
  tryRenderDecisionCenter,
} from '../../ui/decisionCenter'

describe('Phase 5 Stage 2 — AI Decision Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.decision_center default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(DECISION_CENTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(DECISION_CENTER_FEATURE_ID)).toBe(
        false,
      )
      expect(isDecisionCenterEnabled()).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.wiredIntoBooking).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.wiredIntoMaps).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.wiredIntoWeather).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.wiredIntoNotifications).toBe(false)
      expect(DECISION_CENTER_ARCHITECTURE.actualAiReasoning).toBe(false)
      expect(tryRenderDecisionCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(DecisionCenter))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-dc',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-dc',
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
    it('exposes decision types, state tags, and isolation', () => {
      expect(DECISION_TYPES).toEqual(
        expect.arrayContaining([
          'flight_choice',
          'hotel_choice',
          'transportation',
          'budget_recommendation',
          'travel_route',
        ]),
      )
      expect(DECISION_STATE_TAGS).toEqual(
        expect.arrayContaining([
          'recommended',
          'alternative',
          'best_value',
          'fastest',
          'luxury',
          'budget',
          'eco',
        ]),
      )
      expect(assertDecisionCenterIsolation().presentationOnly).toBe(true)
      expect(createDemoDecisionCenterState({ enabled: true }).confidence).toBeGreaterThan(
        0,
      )
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders summary, confidence, comparison, tree, and alternatives', () => {
      const html = renderToStaticMarkup(
        createElement(DecisionCenter, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
        }),
      )

      expect(html).toContain('data-testid="decision-center"')
      expect(html).toContain('data-testid="dc-summary"')
      expect(html).toContain('data-testid="dc-why"')
      expect(html).toContain('data-testid="dc-pros"')
      expect(html).toContain('data-testid="dc-cons"')
      expect(html).toContain('data-testid="dc-confidence"')
      expect(html).toContain('data-testid="dc-score-bars"')
      expect(html).toContain('data-testid="dc-comparison"')
      expect(html).toContain('data-testid="dc-decision-tree"')
      expect(html).toContain('data-testid="dc-alternatives"')
      expect(html).toContain('data-testid="dc-cost-chart"')
      expect(html).toContain('data-tag="recommended"')
      expect(html).toContain('data-decision-type="flight_choice"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('openai')
      expect(html).not.toContain('amadeus')
    })
  })
})
