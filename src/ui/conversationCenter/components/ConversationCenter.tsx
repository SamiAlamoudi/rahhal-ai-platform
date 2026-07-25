/**
 * Phase 4 Stage 2 — Premium AI Conversation Center root.
 * Renders only when `ui.conversation_center` is enabled (or forced).
 * Not mounted in production main.tsx. No AI / networking / speech.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './conversationCenter.css'
import { isConversationCenterEnabled } from '../conversationCenterRegistry'
import { conversationTokenCssVariables } from '../design/conversationTokens'
import {
  createDemoMessage,
  createInitialConversationCenterState,
  filterThreadsByBucket,
  resolveConversationEmptyState,
  searchThreads,
} from '../state/conversationCenterState'
import type {
  ConversationCenterLocale,
  ConversationCenterMessage,
  ConversationCenterUiState,
  ConversationExternalNavTarget,
  ConversationListBucket,
  ConversationMessageActionId,
  ConversationThreadActionId,
} from '../types'
import { Composer } from './Composer'
import { ConversationSidebar } from './ConversationSidebar'
import { EmptyStates } from './EmptyStates'
import { MessageList } from './MessageList'

export interface ConversationCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: ConversationCenterLocale
  initialState?: Partial<ConversationCenterUiState>
  onExternalNav?: (target: ConversationExternalNavTarget) => void
}

export function ConversationCenter({
  enabled,
  locale = 'ar',
  initialState,
  onExternalNav,
}: ConversationCenterProps) {
  const centerOn = isConversationCenterEnabled({ enabled })
  const [state, setState] = useState<ConversationCenterUiState>(() =>
    createInitialConversationCenterState({
      locale: initialState?.locale ?? locale,
      enabled,
      threads: initialState?.threads,
      messagesByConversation: initialState?.messagesByConversation,
      activeConversationId: initialState?.activeConversationId,
    }),
  )

  const cssVars = useMemo(
    () => conversationTokenCssVariables() as CSSProperties,
    [],
  )

  if (!centerOn) return null

  const emptyKind = resolveConversationEmptyState(state)
  const sectionThreads = filterThreadsByBucket(state.threads, state.sidebarBucket)
  const visibleThreads = searchThreads(sectionThreads, state.searchQuery)
  const activeMessages: ConversationCenterMessage[] =
    state.activeConversationId != null
      ? (state.messagesByConversation[state.activeConversationId] ?? [])
      : []

  const setComposerValue = (value: string) => {
    setState((prev) => ({
      ...prev,
      composer: { ...prev.composer, value },
    }))
  }

  const handleSubmit = (value: string) => {
    const conversationId =
      state.activeConversationId ?? `local-${Date.now().toString(36)}`
    const traveler = createDemoMessage({
      id: `m-${Date.now().toString(36)}`,
      conversationId,
      kind: 'traveler',
      role: 'user',
      body: value,
    })
    setState((prev) => {
      const threads = prev.threads.some((t) => t.id === conversationId)
        ? prev.threads.map((t) =>
            t.id === conversationId
              ? {
                  ...t,
                  preview: value,
                  updatedAt: traveler.createdAt,
                  draft: false,
                }
              : t,
          )
        : [
            {
              id: conversationId,
              title: value.slice(0, 40) || 'محادثة جديدة',
              bucket: 'recent' as const,
              pinned: false,
              favorite: false,
              archived: false,
              draft: false,
              template: false,
              unreadCount: 0,
              updatedAt: traveler.createdAt,
              preview: value,
            },
            ...prev.threads,
          ]
      const messages = [...(prev.messagesByConversation[conversationId] ?? []), traveler]
      return {
        ...prev,
        activeConversationId: conversationId,
        threads,
        messagesByConversation: {
          ...prev.messagesByConversation,
          [conversationId]: messages,
        },
        composer: { ...prev.composer, value: '' },
        emptyState: null,
      }
    })
  }

  const handleThreadAction = (action: ConversationThreadActionId, threadId: string) => {
    setState((prev) => ({
      ...prev,
      threads: prev.threads
        .map((t) => {
          if (t.id !== threadId) return t
          switch (action) {
            case 'pin':
              return { ...t, pinned: !t.pinned }
            case 'favorite':
              return { ...t, favorite: !t.favorite }
            case 'archive':
              return { ...t, archived: true }
            case 'rename':
              return { ...t, title: `${t.title}*` }
            case 'delete':
              return t
            case 'export':
            case 'share':
              return t
            default:
              return t
          }
        })
        .filter((t) => !(action === 'delete' && t.id === threadId)),
      activeConversationId:
        action === 'delete' && prev.activeConversationId === threadId
          ? null
          : prev.activeConversationId,
    }))
  }

  const handleMessageAction = (
    action: ConversationMessageActionId,
    messageId: string,
  ) => {
    if (action !== 'expand' && action !== 'collapse') return
    const conversationId = state.activeConversationId
    if (!conversationId) return
    setState((prev) => ({
      ...prev,
      messagesByConversation: {
        ...prev.messagesByConversation,
        [conversationId]: (prev.messagesByConversation[conversationId] ?? []).map(
          (m) =>
            m.id === messageId
              ? { ...m, expanded: action === 'expand', expandable: true }
              : m,
        ),
      },
    }))
  }

  return (
    <div
      className="rahhal-cc"
      data-testid="conversation-center"
      data-cc="conversation-center"
      data-locale={state.locale}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <ConversationSidebar
        threads={visibleThreads}
        activeConversationId={state.activeConversationId}
        bucket={state.sidebarBucket}
        searchQuery={state.searchQuery}
        locale={state.locale}
        onBucketChange={(bucket: ConversationListBucket) =>
          setState((prev) => ({ ...prev, sidebarBucket: bucket }))
        }
        onSearchChange={(searchQuery) =>
          setState((prev) => ({ ...prev, searchQuery }))
        }
        onSelectThread={(id) =>
          setState((prev) => ({
            ...prev,
            activeConversationId: id,
            emptyState: null,
            threads: prev.threads.map((t) =>
              t.id === id ? { ...t, unreadCount: 0 } : t,
            ),
          }))
        }
        onThreadAction={handleThreadAction}
        onNewConversation={() =>
          setState((prev) => ({
            ...prev,
            activeConversationId: null,
            emptyState: 'first_conversation',
            composer: { ...prev.composer, value: '' },
          }))
        }
      />

      <main className="rahhal-cc-main" data-testid="cc-main">
        {emptyKind && activeMessages.length === 0 ? (
          <EmptyStates kind={emptyKind} locale={state.locale} />
        ) : (
          <MessageList
            messages={activeMessages}
            locale={state.locale}
            showJumpToLatest={state.jumpToLatestVisible}
            onJumpToLatest={() =>
              setState((prev) => ({ ...prev, jumpToLatestVisible: false }))
            }
            onMessageAction={handleMessageAction}
          />
        )}

        <div className="rahhal-cc-composer-dock" data-testid="cc-composer-dock">
          <Composer
            model={state.composer}
            locale={state.locale}
            onChange={setComposerValue}
            onSubmit={handleSubmit}
            onQuickAction={(id) =>
              setComposerValue(
                state.locale === 'en' ? `Quick: ${id}` : `اختصار: ${id}`,
              )
            }
            onExternalNav={onExternalNav}
          />
        </div>
      </main>
    </div>
  )
}

/** Safe render helper for tests — returns null when flag OFF. */
export function tryRenderConversationCenter(
  props: ConversationCenterProps = {},
): ReactElement | null {
  if (!isConversationCenterEnabled({ enabled: props.enabled })) return null
  return <ConversationCenter {...props} />
}
