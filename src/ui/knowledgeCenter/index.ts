/**
 * Phase 4 Stage 4 — Knowledge Center barrel.
 *
 * Isolated UI architecture. Own destination — not inside Chat or Voice.
 * Not wired into production main.tsx, Runtime Coordinator, Conversation
 * Orchestrator, or Voice Center. Gated by `ui.knowledge_center` (default OFF).
 */

export {
  KNOWLEDGE_CENTER_FEATURE_ID,
  isKnowledgeCenterEnabled,
  KnowledgeCenterRegistry,
} from './knowledgeCenterRegistry'

export type {
  KnowledgeCenterLocale,
  KnowledgeMainSection,
  KnowledgeDocumentType,
  KnowledgeOrganizationKind,
  KnowledgeSmartPanel,
  KnowledgeSidebarNav,
  KnowledgeDocumentAction,
  KnowledgeReaderMode,
  KnowledgeDocument,
  KnowledgeSearchFilters,
  KnowledgeReaderState,
  KnowledgeCenterUiState,
} from './types'

export {
  KNOWLEDGE_MAIN_SECTIONS,
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_ORGANIZATIONS,
  KNOWLEDGE_SMART_PANELS,
  KNOWLEDGE_SIDEBAR_NAV,
  KNOWLEDGE_DOCUMENT_ACTIONS,
  KNOWLEDGE_CENTER_ISOLATION,
} from './types'

export {
  KNOWLEDGE_TOKENS,
  knowledgeTokenCssVariables,
} from './design/knowledgeTokens'

export {
  createDefaultFilters,
  createInitialKnowledgeCenterState,
  filterKnowledgeDocuments,
  createDemoDocument,
  assertKnowledgeCenterIsolation,
} from './state/knowledgeCenterState'

export * from './components'

/** Architecture inventory for docs / tests. */
export const KNOWLEDGE_CENTER_ARCHITECTURE = {
  version: '4.4.0-knowledge-center',
  featureId: 'ui.knowledge_center' as const,
  wiredIntoProductionRoutes: false,
  wiredIntoRuntimeCoordinator: false,
  wiredIntoConversationOrchestrator: false,
  wiredIntoVoiceCenter: false,
  embeddedInChat: false,
  embeddedInVoice: false,
  booksDedicatedSection: true,
  knowledgeLoading: false,
  embeddings: false,
  vectorDatabase: false,
  rag: false,
  searchApis: false,
  cloudStorage: false,
  ocr: false,
  aiCalls: false,
  regions: ['sidebar', 'smart_panels', 'library', 'books', 'reader'] as const,
  readerModes: ['pdf', 'book', 'image', 'none'] as const,
} as const
