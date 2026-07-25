/**
 * Phase 4 Stage 2 — Premium AI Conversation Center barrel.
 *
 * Isolated UI architecture package. Not wired into production main.tsx,
 * Runtime Coordinator, or Conversation Orchestrator.
 * Gated by `ui.conversation_center` (default OFF).
 */

export {
  CONVERSATION_CENTER_FEATURE_ID,
  isConversationCenterEnabled,
  ConversationCenterRegistry,
} from './conversationCenterRegistry'

export type {
  ConversationCenterLocale,
  ConversationMessageKind,
  ConversationListBucket,
  ConversationEmptyStateKind,
  ConversationExternalNavTarget,
  ConversationMessageActionId,
  ConversationMessageAction,
  ConversationThreadActionId,
  ConversationCenterMessage,
  ConversationCenterThread,
  ConversationComposerModel,
  ConversationCenterUiState,
} from './types'

export {
  CONVERSATION_MESSAGE_KINDS,
  CONVERSATION_SIDEBAR_BUCKETS,
  CONVERSATION_CARD_KINDS,
  DEFAULT_MESSAGE_ACTIONS,
  DEFAULT_COMPOSER_EXTERNAL_NAV,
  isConversationCardKind,
} from './types'

export {
  CONVERSATION_TOKENS,
  conversationTokenCssVariables,
} from './design/conversationTokens'

export {
  createDefaultComposer,
  createInitialConversationCenterState,
  filterThreadsByBucket,
  searchThreads,
  resolveConversationEmptyState,
  createDemoMessage,
  assertConversationIsolation,
} from './state/conversationCenterState'

export * from './components'

/** Architecture inventory for docs / tests. */
export const CONVERSATION_CENTER_ARCHITECTURE = {
  version: '4.2.0-conversation-center',
  featureId: 'ui.conversation_center' as const,
  wiredIntoProductionRoutes: false,
  wiredIntoRuntimeCoordinator: false,
  wiredIntoConversationOrchestrator: false,
  aiCalls: false,
  networking: false,
  speechInsideChat: false,
  knowledgeInsideChat: false,
  booksInsideChat: false,
  regions: ['sidebar', 'thread', 'composer_dock'] as const,
  sidebarBuckets: [
    'recent',
    'pinned',
    'favorites',
    'archived',
    'drafts',
    'templates',
  ] as const,
  messageKinds: [
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
  ] as const,
  composerPlaceholders: [
    'attachment',
    'image',
    'microphone',
    'camera',
    'location',
    'voice_nav',
    'knowledge_nav',
  ] as const,
} as const
