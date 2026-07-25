/**
 * Phase 5 Stage 5 — AI Memory & Knowledge Center barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime, Database, Firebase, Chat, auth, sync, storage, or search backends.
 * Gated by `ui.memory_center` (default OFF).
 */

import { MEMORY_CENTER_ISOLATION as MC_ISOLATION } from './types'

export {
  MEMORY_CENTER_FEATURE_ID,
  isMemoryCenterEnabled,
  MemoryCenterRegistry,
} from './memoryCenterRegistry'

export type {
  MemoryCenterLocale,
  MemoryCenterTheme,
  MemoryFilterId,
  MemoryStatCard,
  MemoryTimelineItem,
  MemoryPlaceItem,
  MemoryPreferenceChip,
  MemoryPersonCard,
  MemoryDocumentCard,
  MemoryConversationItem,
  MemoryRuleItem,
  MemorySourceBadge,
  MemoryCategoryChip,
  MemoryGraphNode,
  MemoryCenterUiState,
} from './types'

export {
  MEMORY_FILTERS,
  MEMORY_CENTER_ISOLATION,
} from './types'

export {
  MEMORY_CENTER_TOKENS,
  memoryCenterTokenCssVariables,
} from './design/memoryCenterTokens'

export {
  createDemoMemoryCenterState,
  assertMemoryCenterIsolation,
} from './state/memoryCenterState'

export {
  MemoryCenter,
  tryRenderMemoryCenter,
} from './components/MemoryCenter'
export type { MemoryCenterProps } from './components/MemoryCenter'
export { MemoryToolbar } from './components/MemoryToolbar'
export { MemoryOverview } from './components/MemoryOverview'
export { MemoryTimelinePanel } from './components/MemoryTimelinePanel'
export { PlacesAndPreferences } from './components/PlacesAndPreferences'
export { PeopleAndDocuments } from './components/PeopleAndDocuments'
export { RulesAndKnowledge } from './components/RulesAndKnowledge'

export const MEMORY_CENTER_ARCHITECTURE = {
  version: '5.5.0-memory-center',
  featureId: 'ui.memory_center' as const,
  presentationOnly: true,
  regions: [
    'overview',
    'memory_timeline',
    'known_destinations',
    'favorites',
    'preferences',
    'budget_history',
    'people',
    'documents',
    'saved',
    'conversation_memories',
    'rules',
    'knowledge_sources',
    'confidence',
    'categories',
    'search',
    'filters',
    'bookmarks',
    'edit_delete_placeholders',
  ] as const,
  ...MC_ISOLATION,
} as const
