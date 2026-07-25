/**
 * Phase 5 Stage 5 — AI Memory & Knowledge Center tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  MEMORY_CENTER_ARCHITECTURE,
  MEMORY_CENTER_FEATURE_ID,
  MEMORY_FILTERS,
  MemoryCenter,
  assertMemoryCenterIsolation,
  createDemoMemoryCenterState,
  isMemoryCenterEnabled,
  tryRenderMemoryCenter,
} from '../../ui/memoryCenter'

describe('Phase 5 Stage 5 — AI Memory & Knowledge Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.memory_center default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(MEMORY_CENTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(MEMORY_CENTER_FEATURE_ID)).toBe(
        false,
      )
      expect(isMemoryCenterEnabled()).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.wiredIntoDatabase).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.wiredIntoChat).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.authentication).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.sync).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.storage).toBe(false)
      expect(MEMORY_CENTER_ARCHITECTURE.searchBackend).toBe(false)
      expect(tryRenderMemoryCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(MemoryCenter))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-mc',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-mc',
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
      expect(MEMORY_FILTERS).toEqual([
        'all',
        'destinations',
        'preferences',
        'documents',
        'conversations',
        'rules',
      ])
      expect(assertMemoryCenterIsolation().presentationOnly).toBe(true)
      const demo = createDemoMemoryCenterState({ enabled: true })
      expect(demo.timeline.length).toBeGreaterThan(0)
      expect(demo.conversationMemories.length).toBeGreaterThan(0)
      expect(demo.confidenceAverage).toBeGreaterThan(0)
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders memory sections, rules, search, and placeholders', () => {
      const html = renderToStaticMarkup(
        createElement(MemoryCenter, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
        }),
      )

      expect(html).toContain('data-testid="memory-center"')
      expect(html).toContain('data-testid="mc-overview"')
      expect(html).toContain('data-testid="mc-memory-timeline"')
      expect(html).toContain('data-testid="mc-known-destinations"')
      expect(html).toContain('data-testid="mc-favorite-countries"')
      expect(html).toContain('data-testid="mc-favorite-cities"')
      expect(html).toContain('data-testid="mc-favorite-hotels"')
      expect(html).toContain('data-testid="mc-favorite-airlines"')
      expect(html).toContain('data-testid="mc-travel-preferences"')
      expect(html).toContain('data-testid="mc-seat-preferences"')
      expect(html).toContain('data-testid="mc-meal-preferences"')
      expect(html).toContain('data-testid="mc-budget-history"')
      expect(html).toContain('data-testid="mc-family-members"')
      expect(html).toContain('data-testid="mc-emergency-contacts"')
      expect(html).toContain('data-testid="mc-passports"')
      expect(html).toContain('data-testid="mc-visa-history"')
      expect(html).toContain('data-testid="mc-saved-places"')
      expect(html).toContain('data-testid="mc-saved-trips"')
      expect(html).toContain('data-testid="mc-conversation-memories"')
      expect(html).toContain('data-testid="mc-custom-rules"')
      expect(html).toContain('data-testid="mc-always-do"')
      expect(html).toContain('data-testid="mc-never-do"')
      expect(html).toContain('data-testid="mc-knowledge-sources"')
      expect(html).toContain('data-testid="mc-confidence"')
      expect(html).toContain('data-testid="mc-confidence-meter"')
      expect(html).toContain('data-testid="mc-memory-categories"')
      expect(html).toContain('data-testid="mc-memory-graph"')
      expect(html).toContain('data-testid="mc-search"')
      expect(html).toContain('data-testid="mc-filters"')
      expect(html).toContain('data-testid="mc-bookmarks"')
      expect(html).toContain('data-testid="mc-edit-placeholder"')
      expect(html).toContain('data-testid="mc-delete-placeholder"')
      expect(html).toContain('data-filter="all"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('openai')
      expect(html).not.toContain('firebase')
      expect(html).not.toContain('supabase.from')
    })
  })
})
