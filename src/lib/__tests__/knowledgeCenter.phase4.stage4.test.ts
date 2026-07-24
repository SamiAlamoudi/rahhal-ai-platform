/**
 * Phase 4 Stage 4 — Knowledge Center tests.
 * New tests only. Knowledge Center is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  KNOWLEDGE_CENTER_ARCHITECTURE,
  KNOWLEDGE_CENTER_FEATURE_ID,
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_MAIN_SECTIONS,
  KnowledgeCenter,
  assertKnowledgeCenterIsolation,
  createDemoDocument,
  createInitialKnowledgeCenterState,
  filterKnowledgeDocuments,
  isKnowledgeCenterEnabled,
  tryRenderKnowledgeCenter,
} from '../../ui/knowledgeCenter'

describe('Phase 4 Stage 4 — Knowledge Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.knowledge_center default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(KNOWLEDGE_CENTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(KNOWLEDGE_CENTER_FEATURE_ID)).toBe(false)
      expect(isKnowledgeCenterEnabled()).toBe(false)
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.wiredIntoRuntimeCoordinator).toBe(false)
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.wiredIntoConversationOrchestrator).toBe(
        false,
      )
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.wiredIntoVoiceCenter).toBe(false)
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.embeddedInChat).toBe(false)
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.embeddedInVoice).toBe(false)
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.booksDedicatedSection).toBe(true)
      expect(KNOWLEDGE_CENTER_ARCHITECTURE.rag).toBe(false)
      expect(tryRenderKnowledgeCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(KnowledgeCenter))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-kc',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-kc',
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
    it('keeps Knowledge as own destination; books not in Chat/Voice', () => {
      const isolation = assertKnowledgeCenterIsolation()
      expect(isolation.ownDestination).toBe(true)
      expect(isolation.notInsideChat).toBe(true)
      expect(isolation.notInsideVoice).toBe(true)
      expect(isolation.booksOnlyInKnowledge).toBe(true)
      expect(isolation.knowledgeLoading).toBe(false)
      expect(isolation.embeddings).toBe(false)
      expect(isolation.vectorDatabase).toBe(false)
      expect(isolation.rag).toBe(false)
      expect(isolation.searchApis).toBe(false)
      expect(isolation.ocr).toBe(false)
      expect(isolation.aiCalls).toBe(false)
      expect(isolation.voiceCenterWiring).toBe(false)
    })
  })

  describe('sections, types, filters', () => {
    it('exposes required sections and document types including books', () => {
      expect(KNOWLEDGE_MAIN_SECTIONS).toEqual(
        expect.arrayContaining([
          'travel_guides',
          'country_guides',
          'visa_library',
          'airline_information',
          'airport_guides',
          'hotel_guides',
          'transportation',
          'emergency_contacts',
          'embassies',
          'travel_tips',
          'faq',
          'company_policies',
          'executive_travel_manuals',
          'books',
        ]),
      )
      expect(KNOWLEDGE_DOCUMENT_TYPES).toEqual(
        expect.arrayContaining([
          'pdf',
          'book',
          'markdown',
          'image',
          'travel_document',
          'map',
          'video',
          'audio',
        ]),
      )
    })

    it('filters by query, favorites, and section', () => {
      const docs = [
        createDemoDocument({
          id: 'd1',
          title: 'دليل باريس',
          section: 'travel_guides',
          type: 'pdf',
          favorite: true,
          tags: ['france'],
          preview: 'مدينة النور',
        }),
        createDemoDocument({
          id: 'd2',
          title: 'Visa Guide',
          section: 'visa_library',
          type: 'markdown',
          favorite: false,
          preview: 'Schengen',
        }),
        createDemoDocument({
          id: 'b1',
          title: 'Book One',
          section: 'books',
          type: 'book',
          preview: 'Reserved',
        }),
      ]
      const state = createInitialKnowledgeCenterState({
        enabled: true,
        documents: docs,
        activeSection: 'travel_guides',
      })
      expect(
        filterKnowledgeDocuments(
          docs,
          state.filters,
          [],
          'travel_guides',
        ).map((d) => d.id),
      ).toEqual(['d1'])

      expect(
        filterKnowledgeDocuments(
          docs,
          { ...state.filters, query: 'visa' },
          [],
          'travel_guides',
        ).map((d) => d.id),
      ).toEqual(['d2'])

      expect(
        filterKnowledgeDocuments(
          docs,
          { ...state.filters, showFavorites: true },
          [],
          'travel_guides',
        ).map((d) => d.id),
      ).toEqual(['d1'])
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders knowledge chrome, books shelf, filters, and reader empty state', () => {
      const html = renderToStaticMarkup(
        createElement(KnowledgeCenter, {
          enabled: true,
          locale: 'ar',
          initialState: {
            activeSection: 'travel_guides',
            documents: [
              createDemoDocument({
                id: 'g1',
                title: 'دليل المطار',
                section: 'airport_guides',
                type: 'pdf',
                country: 'AE',
                tags: ['dxb'],
                preview: 'Terminal map',
              }),
              createDemoDocument({
                id: 'book-a',
                title: 'كتاب رحّال',
                section: 'books',
                type: 'book',
                preview: 'Shelf placeholder',
              }),
            ],
          },
        }),
      )

      expect(html).toContain('data-testid="knowledge-center"')
      expect(html).toContain('data-testid="kc-sidebar"')
      expect(html).toContain('data-testid="kc-brand"')
      expect(html).toContain('رحّال')
      expect(html).toContain('data-section="travel_guides"')
      expect(html).toContain('data-section="books"')
      expect(html).toContain('data-testid="kc-global-search"')
      expect(html).toContain('data-testid="kc-filters"')
      expect(html).toContain('data-testid="kc-smart-panels"')
      expect(html).toContain('data-smart-panel="downloads"')
      expect(html).toContain('data-testid="kc-organization"')
      expect(html).toContain('data-org="visas"')
      expect(html).toContain('data-testid="kc-document-library"')
      expect(html).toContain('data-testid="kc-reader-empty"')
      expect(html).not.toContain('data-testid="conversation-center"')
      expect(html).not.toContain('data-testid="voice-center"')
      expect(html).not.toContain('vector')
      expect(html).not.toContain('embedding')
    })

    it('renders dedicated books section with two reserved slots when empty', () => {
      const html = renderToStaticMarkup(
        createElement(KnowledgeCenter, {
          enabled: true,
          initialState: { activeSection: 'books', documents: [] },
        }),
      )
      expect(html).toContain('data-testid="kc-books-section"')
      expect(html).toContain('data-books-dedicated="true"')
      expect(html).toContain('data-testid="kc-book-slot-1"')
      expect(html).toContain('data-testid="kc-book-slot-2"')
    })
  })
})
