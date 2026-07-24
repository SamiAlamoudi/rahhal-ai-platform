/**
 * Phase 4 Stage 2 — Premium AI Conversation Center contracts.
 * UI architecture only. No AI, networking, speech, or knowledge loading.
 */

export type ConversationCenterLocale = 'ar' | 'en'

export type ConversationMessageKind =
  | 'traveler'
  | 'assistant'
  | 'system'
  | 'thinking'
  | 'loading'
  | 'error'
  | 'clarification'
  | 'recommendation'
  | 'warning'
  | 'success'
  | 'timeline'
  | 'executive_summary'
  | 'travel_plan'
  | 'destination_card'
  | 'hotel_card'
  | 'flight_card'
  | 'transportation_card'
  | 'visa_card'
  | 'weather_card'
  | 'budget_card'
  | 'checklist_card'
  | 'action_card'
  | 'expandable_card'

export type ConversationListBucket =
  | 'recent'
  | 'pinned'
  | 'favorites'
  | 'archived'
  | 'drafts'
  | 'templates'

export type ConversationEmptyStateKind =
  | 'first_conversation'
  | 'no_history'
  | 'no_search_results'
  | 'offline'
  | 'loading'

/** External navigation targets — never embed Voice/Knowledge/Books inside Chat. */
export type ConversationExternalNavTarget =
  | 'voice_center'
  | 'knowledge_center'
  | 'attachment_future'
  | 'image_future'
  | 'microphone_future'
  | 'camera_future'
  | 'location_future'
  | 'export_future'
  | 'share_future'

export type ConversationMessageActionId =
  | 'copy'
  | 'like'
  | 'dislike'
  | 'regenerate'
  | 'expand'
  | 'collapse'
  | 'references'

export interface ConversationMessageAction {
  id: ConversationMessageActionId
  labelKey: string
  placeholder?: boolean
}

export type ConversationThreadActionId =
  | 'pin'
  | 'archive'
  | 'rename'
  | 'delete'
  | 'export'
  | 'share'
  | 'favorite'

export interface ConversationCenterMessage {
  id: string
  conversationId: string
  kind: ConversationMessageKind
  role: 'user' | 'assistant' | 'system'
  body: string
  createdAt: string
  expandable: boolean
  expanded: boolean
  confidence: number | null
  streamingPlaceholder: boolean
  unread: boolean
  cardTitle: string | null
  actions: ConversationMessageAction[]
}

export interface ConversationCenterThread {
  id: string
  title: string
  bucket: ConversationListBucket
  pinned: boolean
  favorite: boolean
  archived: boolean
  draft: boolean
  template: boolean
  unreadCount: number
  updatedAt: string
  preview: string
}

export interface ConversationComposerModel {
  value: string
  autoGrow: true
  minRows: number
  maxRows: number
  quickActions: Array<{ id: string; labelKey: string }>
  /** Placeholders that navigate later — never open Voice/Knowledge inside chat. */
  externalNavButtons: Array<{
    id: ConversationExternalNavTarget
    labelKey: string
    navigatesTo: ConversationExternalNavTarget
  }>
}

export interface ConversationCenterUiState {
  locale: ConversationCenterLocale
  activeConversationId: string | null
  threads: ConversationCenterThread[]
  messagesByConversation: Record<string, ConversationCenterMessage[]>
  searchQuery: string
  sidebarBucket: ConversationListBucket
  emptyState: ConversationEmptyStateKind | null
  jumpToLatestVisible: boolean
  composer: ConversationComposerModel
  featureEnabled: boolean
}

export const CONVERSATION_MESSAGE_KINDS: readonly ConversationMessageKind[] = [
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
] as const

export const CONVERSATION_SIDEBAR_BUCKETS: readonly ConversationListBucket[] = [
  'recent',
  'pinned',
  'favorites',
  'archived',
  'drafts',
  'templates',
] as const

export const DEFAULT_MESSAGE_ACTIONS: ConversationMessageAction[] = [
  { id: 'copy', labelKey: 'cc.action.copy' },
  { id: 'like', labelKey: 'cc.action.like' },
  { id: 'dislike', labelKey: 'cc.action.dislike' },
  { id: 'regenerate', labelKey: 'cc.action.regenerate' },
  { id: 'expand', labelKey: 'cc.action.expand' },
  { id: 'collapse', labelKey: 'cc.action.collapse' },
  { id: 'references', labelKey: 'cc.action.references', placeholder: true },
]

export const DEFAULT_COMPOSER_EXTERNAL_NAV: ConversationComposerModel['externalNavButtons'] = [
  { id: 'attachment_future', labelKey: 'cc.composer.attachment', navigatesTo: 'attachment_future' },
  { id: 'image_future', labelKey: 'cc.composer.image', navigatesTo: 'image_future' },
  { id: 'microphone_future', labelKey: 'cc.composer.microphone', navigatesTo: 'microphone_future' },
  { id: 'camera_future', labelKey: 'cc.composer.camera', navigatesTo: 'camera_future' },
  { id: 'location_future', labelKey: 'cc.composer.location', navigatesTo: 'location_future' },
  { id: 'voice_center', labelKey: 'cc.composer.voice_nav', navigatesTo: 'voice_center' },
  { id: 'knowledge_center', labelKey: 'cc.composer.knowledge_nav', navigatesTo: 'knowledge_center' },
]

/** Card-like message kinds rendered via TravelCard placeholders. */
export const CONVERSATION_CARD_KINDS: readonly ConversationMessageKind[] = [
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
] as const

export function isConversationCardKind(kind: ConversationMessageKind): boolean {
  return (CONVERSATION_CARD_KINDS as readonly string[]).includes(kind)
}
