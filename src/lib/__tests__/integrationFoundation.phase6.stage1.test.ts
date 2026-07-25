/**
 * Phase 6 Stage 1 — Integration Foundation tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  INTEGRATION_FOUNDATION_ARCHITECTURE,
  INTEGRATION_FOUNDATION_FEATURE_ID,
  INTEGRATION_MODULES,
  IntegrationFoundation,
  ModuleLoader,
  ModuleRegistry,
  NavigationRegistry,
  RouteRegistry,
  assertIntegrationFoundationIsolation,
  createDemoIntegrationFoundationState,
  isIntegrationFoundationEnabled,
  listModuleStatuses,
  tryRenderIntegrationFoundation,
} from '../../ui/integrationFoundation'

describe('Phase 6 Stage 1 — Integration Foundation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.integration_foundation default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(INTEGRATION_FOUNDATION_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(
        getFeatureRegistry().isEnabled(INTEGRATION_FOUNDATION_FEATURE_ID),
      ).toBe(false)
      expect(isIntegrationFoundationEnabled()).toBe(false)
      expect(
        INTEGRATION_FOUNDATION_ARCHITECTURE.wiredIntoProductionRoutes,
      ).toBe(false)
      expect(INTEGRATION_FOUNDATION_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(INTEGRATION_FOUNDATION_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(INTEGRATION_FOUNDATION_ARCHITECTURE.wiredIntoApis).toBe(false)
      expect(INTEGRATION_FOUNDATION_ARCHITECTURE.businessLogic).toBe(false)
      expect(INTEGRATION_FOUNDATION_ARCHITECTURE.serviceLayer).toBe(false)
      expect(INTEGRATION_FOUNDATION_ARCHITECTURE.apiLayer).toBe(false)
      expect(tryRenderIntegrationFoundation({})).toBeNull()
      expect(
        renderToStaticMarkup(createElement(IntegrationFoundation)),
      ).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-if',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-if',
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

  describe('registries', () => {
    it('catalogs integrated modules, nav, and virtual routes', () => {
      expect(assertIntegrationFoundationIsolation().presentationOnly).toBe(
        true,
      )
      expect(INTEGRATION_MODULES).toHaveLength(13)
      expect(ModuleRegistry.ids()).toContain('operations_center')
      expect(ModuleRegistry.ids()).toContain('application_shell')
      expect(NavigationRegistry.developer().length).toBeGreaterThan(0)
      expect(NavigationRegistry.demo()).toHaveLength(13)
      expect(RouteRegistry.all().some((r) => r.path.startsWith('/dev/'))).toBe(
        true,
      )
      expect(
        INTEGRATION_FOUNDATION_ARCHITECTURE.integratedModules,
      ).toHaveLength(13)
      const demo = createDemoIntegrationFoundationState({ enabled: true })
      expect(demo.activeScreen).toBe('developer_nav')
      const statuses = listModuleStatuses()
      expect(statuses.every((s) => s.registered)).toBe(true)
      expect(statuses.every((s) => s.flagEnabled === false)).toBe(true)
    })

    it('loads a module preview via ModuleLoader forceEnabled', () => {
      const el = ModuleLoader.load('insights_center', {
        forceEnabled: true,
        locale: 'ar',
        theme: 'light',
      })
      expect(el).not.toBeNull()
      const html = renderToStaticMarkup(el!)
      expect(html).toContain('data-testid="insights-center"')
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders foundation chrome, screens, and shared states', () => {
      const html = renderToStaticMarkup(
        createElement(IntegrationFoundation, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
          initialState: { activeScreen: 'architecture_overview' },
        }),
      )

      expect(html).toContain('data-testid="integration-foundation"')
      expect(html).toContain('data-testid="if-layout"')
      expect(html).toContain('data-testid="if-sidebar"')
      expect(html).toContain('data-testid="if-architecture-overview"')
      expect(html).toContain('data-testid="if-empty-state"')
      expect(html).toContain('data-testid="if-loading-state"')
      expect(html).toContain('data-testid="if-error-state"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('runtime-coordinator')
      expect(html).not.toContain('amadeus-live')
      expect(html).not.toContain('firebase')
    })

    it('renders module status and feature flag screens', () => {
      const statusHtml = renderToStaticMarkup(
        createElement(IntegrationFoundation, {
          enabled: true,
          initialState: { activeScreen: 'module_status' },
        }),
      )
      expect(statusHtml).toContain('data-testid="if-module-status"')
      expect(statusHtml).toContain('data-testid="if-status-badge"')

      const flagsHtml = renderToStaticMarkup(
        createElement(IntegrationFoundation, {
          enabled: true,
          initialState: { activeScreen: 'feature_flags' },
        }),
      )
      expect(flagsHtml).toContain('data-testid="if-feature-flags"')
      expect(flagsHtml).toContain('data-testid="if-flag-toggle"')
      expect(flagsHtml).toContain('ui.booking_hub')

      const graphHtml = renderToStaticMarkup(
        createElement(IntegrationFoundation, {
          enabled: true,
          initialState: { activeScreen: 'dependency_graph' },
        }),
      )
      expect(graphHtml).toContain('data-testid="if-dependency-graph"')
      expect(graphHtml).toContain('ui.application_shell')
    })
  })
})
