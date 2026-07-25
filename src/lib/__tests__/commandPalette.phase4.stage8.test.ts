/**
 * Phase 4 Stage 8 — Universal Search & Command Palette tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  COMMAND_DESTINATIONS,
  COMMAND_PALETTE_ARCHITECTURE,
  COMMAND_PALETTE_FEATURE_ID,
  CommandPalette,
  PALETTE_FILTERS,
  SEARCH_DOMAINS,
  assertCommandPaletteIsolation,
  createInitialCommandPaletteState,
  filterPaletteItems,
  isCommandPaletteEnabled,
  resolveEmptyState,
  tryRenderCommandPalette,
} from '../../ui/commandPalette'

describe('Phase 4 Stage 8 — Universal Search & Command Palette', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.command_palette default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(COMMAND_PALETTE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(COMMAND_PALETTE_FEATURE_ID)).toBe(false)
      expect(isCommandPaletteEnabled()).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.apiCalls).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.aiSearch).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.realtimeSearch).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.wiredIntoChat).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.wiredIntoVoice).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.wiredIntoKnowledge).toBe(false)
      expect(COMMAND_PALETTE_ARCHITECTURE.wiredIntoBooking).toBe(false)
      expect(tryRenderCommandPalette({})).toBeNull()
      expect(renderToStaticMarkup(createElement(CommandPalette))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-cp',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-cp',
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

  describe('inventory + local filtering', () => {
    it('exposes search domains, command destinations, and filters', () => {
      expect(SEARCH_DOMAINS).toEqual(
        expect.arrayContaining([
          'trips',
          'travelers',
          'flights',
          'hotels',
          'documents',
          'notifications',
          'destinations',
        ]),
      )
      expect(COMMAND_DESTINATIONS).toEqual(
        expect.arrayContaining([
          'dashboard',
          'workspace',
          'chat',
          'voice',
          'knowledge',
          'books',
          'settings',
        ]),
      )
      expect(PALETTE_FILTERS).toEqual(
        expect.arrayContaining(['trips', 'messages', 'voice', 'knowledge', 'books']),
      )
      const isolation = assertCommandPaletteIsolation()
      expect(isolation.presentationOnly).toBe(true)
      expect(isolation.indexing).toBe(false)
    })

    it('filters items locally and resolves empty states', () => {
      const state = createInitialCommandPaletteState({ enabled: true })
      const flights = filterPaletteItems(state.items, 'SV123', 'all')
      expect(flights.some((i) => i.id === 'res-flight-sv123')).toBe(true)
      expect(filterPaletteItems(state.items, 'zzzz-none', 'all')).toEqual([])
      expect(resolveEmptyState('zzzz', 0)).toBe('no_results')
      expect(resolveEmptyState('', 0)).toBe('recent_searches')
      expect(resolveEmptyState('', 3)).toBe('suggested_commands')
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders search, commands, filters, layouts, and shortcut placeholders', () => {
      const html = renderToStaticMarkup(
        createElement(CommandPalette, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
          initialState: { open: true },
        }),
      )

      expect(html).toContain('data-testid="command-palette"')
      expect(html).toContain('data-testid="cp-search-input"')
      expect(html).toContain('data-testid="cp-filters"')
      expect(html).toContain('data-filter="trips"')
      expect(html).toContain('data-filter="voice"')
      expect(html).toContain('data-filter="knowledge"')
      expect(html).toContain('data-testid="cp-results"')
      expect(html).toContain('data-destination="dashboard"')
      expect(html).toContain('data-destination="chat"')
      expect(html).toContain('data-destination="books"')
      expect(html).toContain('data-testid="cp-shortcut-meta-k"')
      expect(html).toContain('data-testid="cp-shortcut-ctrl-k"')
      expect(html).toContain('data-layout="grouped"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('data-testid="conversation-center"')
      expect(html).not.toContain('data-testid="voice-center"')
      expect(html).not.toContain('data-testid="knowledge-center"')
    })
  })
})
