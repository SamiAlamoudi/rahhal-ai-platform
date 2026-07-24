/**
 * Phase 4 Stage 2 — Premium AI Conversation Center tests.
 * New tests only. Center is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  CONVERSATION_CENTER_ARCHITECTURE,
  CONVERSATION_CENTER_FEATURE_ID,
  CONVERSATION_MESSAGE_KINDS,
  CONVERSATION_SIDEBAR_BUCKETS,
  ConversationCenter,
  assertConversationIsolation,
  createDemoMessage,
  createInitialConversationCenterState,
  filterThreadsByBucket,
  isConversationCenterEnabled,
  resolveConversationEmptyState,
  searchThreads,
  tryRenderConversationCenter,
} from '../../ui/conversationCenter'

describe('Phase 4 Stage 2 — Premium AI Conversation Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.conversation_center default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(CONVERSATION_CENTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(CONVERSATION_CENTER_FEATURE_ID)).toBe(false)
      expect(isConversationCenterEnabled()).toBe(false)
      expect(CONVERSATION_CENTER_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(CONVERSATION_CENTER_ARCHITECTURE.wiredIntoRuntimeCoordinator).toBe(false)
      expect(CONVERSATION_CENTER_ARCHITECTURE.wiredIntoConversationOrchestrator).toBe(
        false,
      )
      expect(tryRenderConversationCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(ConversationCenter))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-cc',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-cc',
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
    it('keeps Voice, Knowledge, and Books outside Chat (nav placeholders only)', () => {
      const isolation = assertConversationIsolation()
      expect(isolation.voiceOutsideChat).toBe(true)
      expect(isolation.knowledgeOutsideChat).toBe(true)
      expect(isolation.booksOutsideChat).toBe(true)
      expect(isolation.voiceOnlyExternalNav).toBe(true)
      expect(isolation.knowledgeOnlyExternalNav).toBe(true)
      expect(isolation.noSpeechRuntime).toBe(true)
      expect(isolation.noKnowledgeLoading).toBe(true)
      expect(isolation.noAiCalls).toBe(true)
      expect(CONVERSATION_CENTER_ARCHITECTURE.speechInsideChat).toBe(false)
      expect(CONVERSATION_CENTER_ARCHITECTURE.knowledgeInsideChat).toBe(false)
      expect(CONVERSATION_CENTER_ARCHITECTURE.booksInsideChat).toBe(false)
    })
  })

  describe('message + sidebar architecture', () => {
    it('exposes required message kinds including travel cards', () => {
      expect(CONVERSATION_MESSAGE_KINDS).toEqual(
        expect.arrayContaining([
          'traveler',
          'assistant',
          'system',
          'thinking',
          'loading',
          'error',
          'clarification',
          'recommendation',
          'warning',
          'success',
          'timeline',
          'executive_summary',
          'travel_plan',
          'destination_card',
          'hotel_card',
          'flight_card',
          'transportation_card',
          'visa_card',
          'weather_card',
          'budget_card',
          'checklist_card',
          'action_card',
          'expandable_card',
        ]),
      )
      expect(CONVERSATION_SIDEBAR_BUCKETS).toEqual([
        'recent',
        'pinned',
        'favorites',
        'archived',
        'drafts',
        'templates',
      ])
    })

    it('filters, searches, and resolves empty states', () => {
      const threads = [
        {
          id: 't1',
          title: 'رحلة باريس',
          bucket: 'recent' as const,
          pinned: true,
          favorite: false,
          archived: false,
          draft: false,
          template: false,
          unreadCount: 2,
          updatedAt: '2026-07-24T00:00:00.000Z',
          preview: 'فنادق وسط المدينة',
        },
        {
          id: 't2',
          title: 'Draft Istanbul',
          bucket: 'drafts' as const,
          pinned: false,
          favorite: true,
          archived: false,
          draft: true,
          template: false,
          unreadCount: 0,
          updatedAt: '2026-07-24T00:00:00.000Z',
          preview: 'مسودة',
        },
      ]
      expect(filterThreadsByBucket(threads, 'pinned').map((t) => t.id)).toEqual(['t1'])
      expect(filterThreadsByBucket(threads, 'drafts').map((t) => t.id)).toEqual(['t2'])
      expect(searchThreads(threads, 'paris').map((t) => t.id)).toEqual([])
      expect(searchThreads(threads, 'باريس').map((t) => t.id)).toEqual(['t1'])

      const empty = createInitialConversationCenterState({ enabled: true })
      expect(resolveConversationEmptyState(empty)).toBe('first_conversation')

      const searching = {
        ...createInitialConversationCenterState({
          enabled: true,
          threads,
          activeConversationId: 't1',
          messagesByConversation: {
            t1: [
              createDemoMessage({
                id: 'm1',
                conversationId: 't1',
                kind: 'assistant',
                role: 'assistant',
                body: 'مرحبا',
              }),
            ],
          },
        }),
        searchQuery: 'zzzz',
      }
      expect(resolveConversationEmptyState(searching)).toBe('no_search_results')
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders center chrome, sidebar buckets, composer external nav, and message kinds', () => {
      const html = renderToStaticMarkup(
        createElement(ConversationCenter, {
          enabled: true,
          locale: 'ar',
          initialState: {
            threads: [
              {
                id: 'demo',
                title: 'رحلة تجريبية',
                bucket: 'recent',
                pinned: false,
                favorite: false,
                archived: false,
                draft: false,
                template: false,
                unreadCount: 1,
                updatedAt: '2026-07-24T00:00:00.000Z',
                preview: 'ملخص',
              },
            ],
            activeConversationId: 'demo',
            messagesByConversation: {
              demo: [
                createDemoMessage({
                  id: 'u',
                  conversationId: 'demo',
                  kind: 'traveler',
                  role: 'user',
                  body: 'أريد باريس',
                }),
                createDemoMessage({
                  id: 'a',
                  conversationId: 'demo',
                  kind: 'assistant',
                  role: 'assistant',
                  body: 'إليك اقتراحاً',
                  confidence: 0.9,
                  streamingPlaceholder: true,
                }),
                createDemoMessage({
                  id: 'c',
                  conversationId: 'demo',
                  kind: 'hotel_card',
                  role: 'assistant',
                  body: 'Hotel Placeholder',
                  cardTitle: 'فندق النيل',
                  expandable: true,
                }),
                createDemoMessage({
                  id: 't',
                  conversationId: 'demo',
                  kind: 'thinking',
                  role: 'system',
                  body: '',
                }),
              ],
            },
          },
        }),
      )

      expect(html).toContain('data-testid="conversation-center"')
      expect(html).toContain('data-testid="cc-sidebar"')
      expect(html).toContain('data-testid="cc-composer"')
      expect(html).toContain('data-testid="cc-message-list"')
      expect(html).toContain('data-bucket="recent"')
      expect(html).toContain('data-bucket="pinned"')
      expect(html).toContain('data-bucket="templates"')
      expect(html).toContain('data-external-nav="voice_center"')
      expect(html).toContain('data-external-nav="knowledge_center"')
      expect(html).toContain('data-message-kind="traveler"')
      expect(html).toContain('data-message-kind="assistant"')
      expect(html).toContain('data-message-kind="thinking"')
      expect(html).toContain('data-testid="cc-card-hotel_card"')
      expect(html).toContain('data-testid="cc-streaming-placeholder"')
      expect(html).toContain('data-testid="cc-confidence"')
      expect(html).toContain('data-testid="cc-unread"')
      // Must not embed Voice/Knowledge/Books surfaces inside chat markup
      expect(html).not.toContain('data-module="voice_center"')
      expect(html).not.toContain('data-module="knowledge_center"')
      expect(html).not.toContain('data-surface="books"')
    })

    it('renders first-conversation empty state when forced ON with no threads', () => {
      const html = renderToStaticMarkup(
        createElement(ConversationCenter, { enabled: true }),
      )
      expect(html).toContain('data-empty-kind="first_conversation"')
      expect(html).toContain('data-testid="cc-composer-dock"')
    })
  })
})
