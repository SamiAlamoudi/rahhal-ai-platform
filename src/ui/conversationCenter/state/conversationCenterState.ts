import {
  DEFAULT_COMPOSER_EXTERNAL_NAV,
  DEFAULT_MESSAGE_ACTIONS,
  type ConversationCenterLocale,
  type ConversationCenterMessage,
  type ConversationCenterThread,
  type ConversationCenterUiState,
  type ConversationEmptyStateKind,
  type ConversationListBucket,
} from '../types'
import { isConversationCenterEnabled } from '../conversationCenterRegistry'

export function createDefaultComposer(
  value = '',
): ConversationCenterUiState['composer'] {
  return {
    value,
    autoGrow: true,
    minRows: 1,
    maxRows: 8,
    quickActions: [
      { id: 'clarify_dates', labelKey: 'cc.quick.dates' },
      { id: 'clarify_budget', labelKey: 'cc.quick.budget' },
      { id: 'suggest_destination', labelKey: 'cc.quick.destination' },
    ],
    externalNavButtons: [...DEFAULT_COMPOSER_EXTERNAL_NAV],
  }
}

export function createInitialConversationCenterState(options?: {
  locale?: ConversationCenterLocale
  enabled?: boolean
  threads?: ConversationCenterThread[]
  messagesByConversation?: Record<string, ConversationCenterMessage[]>
  activeConversationId?: string | null
}): ConversationCenterUiState {
  const threads = options?.threads ?? []
  const activeConversationId = options?.activeConversationId ?? threads[0]?.id ?? null
  return {
    locale: options?.locale ?? 'ar',
    activeConversationId,
    threads,
    messagesByConversation: options?.messagesByConversation ?? {},
    searchQuery: '',
    sidebarBucket: 'recent',
    emptyState: threads.length === 0 ? 'first_conversation' : null,
    jumpToLatestVisible: false,
    composer: createDefaultComposer(),
    featureEnabled: isConversationCenterEnabled({ enabled: options?.enabled }),
  }
}

export function filterThreadsByBucket(
  threads: ConversationCenterThread[],
  bucket: ConversationListBucket,
): ConversationCenterThread[] {
  switch (bucket) {
    case 'pinned':
      return threads.filter((t) => t.pinned && !t.archived)
    case 'favorites':
      return threads.filter((t) => t.favorite && !t.archived)
    case 'archived':
      return threads.filter((t) => t.archived)
    case 'drafts':
      return threads.filter((t) => t.draft && !t.archived)
    case 'templates':
      return threads.filter((t) => t.template)
    case 'recent':
    default:
      return threads.filter((t) => !t.archived && !t.template)
  }
}

export function searchThreads(
  threads: ConversationCenterThread[],
  query: string,
): ConversationCenterThread[] {
  const q = query.trim().toLowerCase()
  if (!q) return threads
  return threads.filter(
    (t) =>
      t.title.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q),
  )
}

export function resolveConversationEmptyState(
  state: ConversationCenterUiState,
): ConversationEmptyStateKind | null {
  if (state.emptyState === 'offline' || state.emptyState === 'loading') {
    return state.emptyState
  }
  const sectionThreads = filterThreadsByBucket(state.threads, state.sidebarBucket)
  const visible = searchThreads(sectionThreads, state.searchQuery)
  if (state.searchQuery.trim() && visible.length === 0) return 'no_search_results'
  if (state.threads.length === 0) return 'first_conversation'
  if (visible.length === 0) return 'no_history'
  if (!state.activeConversationId) return 'first_conversation'
  const messages = state.messagesByConversation[state.activeConversationId] ?? []
  if (messages.length === 0) return 'first_conversation'
  return null
}

export function createDemoMessage(
  partial: Partial<ConversationCenterMessage> &
    Pick<ConversationCenterMessage, 'id' | 'conversationId' | 'kind' | 'role' | 'body'>,
): ConversationCenterMessage {
  return {
    createdAt: partial.createdAt ?? new Date().toISOString(),
    expandable: partial.expandable ?? false,
    expanded: partial.expanded ?? false,
    confidence: partial.confidence ?? null,
    streamingPlaceholder: partial.streamingPlaceholder ?? false,
    unread: partial.unread ?? false,
    cardTitle: partial.cardTitle ?? null,
    actions: partial.actions ?? [...DEFAULT_MESSAGE_ACTIONS],
    ...partial,
  }
}

/** Isolation assertions — Voice / Knowledge / Books never live inside Chat. */
export function assertConversationIsolation(): {
  voiceOutsideChat: boolean
  knowledgeOutsideChat: boolean
  booksOutsideChat: boolean
  voiceOnlyExternalNav: boolean
  knowledgeOnlyExternalNav: boolean
  noSpeechRuntime: boolean
  noKnowledgeLoading: boolean
  noAiCalls: boolean
} {
  const composer = createDefaultComposer()
  const voiceBtn = composer.externalNavButtons.find((b) => b.id === 'voice_center')
  const knowledgeBtn = composer.externalNavButtons.find((b) => b.id === 'knowledge_center')
  return {
    voiceOutsideChat: true,
    knowledgeOutsideChat: true,
    booksOutsideChat: true,
    voiceOnlyExternalNav: voiceBtn?.navigatesTo === 'voice_center',
    knowledgeOnlyExternalNav: knowledgeBtn?.navigatesTo === 'knowledge_center',
    noSpeechRuntime: true,
    noKnowledgeLoading: true,
    noAiCalls: true,
  }
}
