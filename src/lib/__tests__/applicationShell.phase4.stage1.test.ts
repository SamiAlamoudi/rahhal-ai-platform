/**
 * Phase 4 Stage 1 — Premium Application Shell tests.
 * New tests only. Shell is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  APPLICATION_SHELL_ARCHITECTURE,
  APPLICATION_SHELL_FEATURE_ID,
  ApplicationShell,
  SHELL_DESIGN_TOKENS,
  SHELL_PRIMITIVE_CATALOG,
  SHELL_PRIMITIVE_SPECS,
  assertModuleIsolation,
  buildShellNavigationGraphs,
  canActivateShellPath,
  createDefaultGuardContext,
  createInitialShellState,
  isApplicationShellEnabled,
  listBottomNavModules,
  resolveDeepLink,
  resolveShellThemeTokens,
  setShellBreakpoint,
  setShellThemeMode,
  tryRenderApplicationShell,
} from '../../ui/applicationShell'
import { createTravelAgentService } from '../agent/travelAgentService'

describe('Phase 4 Stage 1 — Premium Application Shell', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.application_shell default OFF', () => {
      expect(getFeatureRegistry().isEnabled(APPLICATION_SHELL_FEATURE_ID)).toBe(false)
      expect(isApplicationShellEnabled()).toBe(false)
      expect(APPLICATION_SHELL_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(tryRenderApplicationShell({})).toBeNull()
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-shell',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-shell',
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

  describe('module isolation rules', () => {
    it('keeps Voice and Knowledge outside Chat; Memory independent', () => {
      const isolation = assertModuleIsolation()
      expect(isolation.voiceOutsideChat).toBe(true)
      expect(isolation.knowledgeOutsideChat).toBe(true)
      expect(isolation.booksOnlyKnowledge).toBe(true)
      expect(isolation.conversationHistoryOnlyAiCenter).toBe(true)
      expect(isolation.memoryIndependent).toBe(true)
    })

    it('exposes primary bottom-nav modules', () => {
      const ids = listBottomNavModules().map((m) => m.id)
      expect(ids).toEqual(
        expect.arrayContaining([
          'home',
          'ai_conversation_center',
          'voice_center',
          'knowledge_center',
          'trips',
        ]),
      )
      expect(ids).not.toContain('memory_center_future')
    })
  })

  describe('navigation architecture', () => {
    it('builds independent graphs with nested + deep links', () => {
      const graphs = buildShellNavigationGraphs()
      expect(graphs.length).toBeGreaterThanOrEqual(9)
      const knowledge = graphs.find((g) => g.moduleId === 'knowledge_center')
      expect(knowledge?.routes.some((r) => r.path.includes('/books'))).toBe(true)
      expect(knowledge?.routes.some((r) => r.path.includes('/pdfs'))).toBe(true)
      expect(resolveDeepLink('/shell/voice/session/demo')?.moduleId).toBe('voice_center')
      expect(resolveDeepLink('/shell/conversation/demo')?.moduleId).toBe(
        'ai_conversation_center',
      )
    })

    it('guards block when shell disabled or unauthenticated', () => {
      const denied = canActivateShellPath(
        '/shell/trips',
        createDefaultGuardContext({
          featureShellEnabled: false,
          isAuthenticated: true,
        }),
      )
      expect(denied.allowed).toBe(false)
      expect(denied.reason).toBe('application_shell_disabled')

      const auth = canActivateShellPath(
        '/shell/trips',
        createDefaultGuardContext({
          featureShellEnabled: true,
          isAuthenticated: false,
        }),
      )
      expect(auth.allowed).toBe(false)
      expect(auth.redirectTo).toBe('/login')

      const ok = canActivateShellPath(
        '/shell/home',
        createDefaultGuardContext({
          featureShellEnabled: true,
          isAuthenticated: true,
        }),
      )
      expect(ok.allowed).toBe(true)
    })
  })

  describe('design system + theme + responsive state', () => {
    it('exposes design tokens and primitive catalog', () => {
      expect(SHELL_DESIGN_TOKENS.spacing.md).toBe(12)
      expect(SHELL_PRIMITIVE_CATALOG.bottomSheets).toBe(true)
      expect(SHELL_PRIMITIVE_SPECS.length).toBeGreaterThanOrEqual(14)
      const dark = resolveShellThemeTokens('dark')
      expect(dark.mode).toBe('dark')
      const systemLight = resolveShellThemeTokens('system', false)
      expect(systemLight.mode).toBe('light')
    })

    it('updates theme and breakpoint in shell state', () => {
      let state = createInitialShellState({ locale: 'en', width: 390, enabled: true })
      expect(state.breakpoint).toBe('phone')
      expect(state.navigation.bottomNavVisible).toBe(true)
      state = setShellThemeMode(state, 'dark')
      expect(state.theme.resolved).toBe('dark')
      state = setShellBreakpoint(state, 1280)
      expect(state.breakpoint).toBe('desktop')
      expect(state.localization.direction).toBe('ltr')
    })
  })

  describe('ApplicationShell render gate', () => {
    it('renders shell chrome when forced ON', () => {
      const html = renderToStaticMarkup(
        createElement(ApplicationShell, {
          enabled: true,
          initialState: { locale: 'ar', width: 390 },
        }),
      )
      expect(html).toContain('data-shell="application-shell"')
      expect(html).toContain('data-shell="bottom-navigation"')
      expect(html).toContain('مركز المحادثة')
      expect(html).toContain('مركز الصوت')
      expect(html).toContain('مركز المعرفة')
    })

    it('renders nothing when flag OFF', () => {
      const html = renderToStaticMarkup(createElement(ApplicationShell, {}))
      expect(html).toBe('')
    })
  })
})
