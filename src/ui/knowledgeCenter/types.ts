/**
 * Phase 4 Stage 4 — Knowledge Center contracts.
 * UI architecture only. No RAG, embeddings, search APIs, OCR, or AI.
 */

export type KnowledgeCenterLocale = 'ar' | 'en'

export type KnowledgeMainSection =
  | 'travel_guides'
  | 'country_guides'
  | 'visa_library'
  | 'airline_information'
  | 'airport_guides'
  | 'hotel_guides'
  | 'transportation'
  | 'emergency_contacts'
  | 'embassies'
  | 'travel_tips'
  | 'faq'
  | 'company_policies'
  | 'executive_travel_manuals'
  | 'books'

export type KnowledgeDocumentType =
  | 'pdf'
  | 'book'
  | 'markdown'
  | 'image'
  | 'travel_document'
  | 'map'
  | 'video'
  | 'audio'

export type KnowledgeOrganizationKind =
  | 'collections'
  | 'folders'
  | 'countries'
  | 'topics'
  | 'executive'
  | 'personal'
  | 'travel_planning'
  | 'visas'
  | 'hotels'
  | 'flights'

export type KnowledgeSmartPanel =
  | 'recently_opened'
  | 'recommended'
  | 'popular'
  | 'favorites'
  | 'downloads'
  | 'offline'

export type KnowledgeSidebarNav =
  | 'navigation'
  | 'collections'
  | 'countries'
  | 'search'
  | 'pinned'
  | 'recent'
  | 'favorites'

export type KnowledgeDocumentAction =
  | 'open'
  | 'preview'
  | 'favorite'
  | 'bookmark'
  | 'share'
  | 'download'
  | 'print'

export type KnowledgeReaderMode = 'pdf' | 'book' | 'image' | 'none'

export interface KnowledgeDocument {
  id: string
  title: string
  section: KnowledgeMainSection
  type: KnowledgeDocumentType
  country: string | null
  language: KnowledgeCenterLocale
  tags: string[]
  favorite: boolean
  bookmarked: boolean
  pinned: boolean
  organization: KnowledgeOrganizationKind[]
  updatedAt: string
  preview: string
}

export interface KnowledgeSearchFilters {
  query: string
  section: KnowledgeMainSection | 'all'
  type: KnowledgeDocumentType | 'all'
  country: string | 'all'
  language: KnowledgeCenterLocale | 'all'
  tag: string | 'all'
  showBookmarks: boolean
  showFavorites: boolean
  showRecent: boolean
}

export interface KnowledgeReaderState {
  mode: KnowledgeReaderMode
  documentId: string | null
  zoom: number
  fullscreen: boolean
  progress: number
  notesPlaceholder: boolean
  highlightsPlaceholder: boolean
}

export interface KnowledgeCenterUiState {
  locale: KnowledgeCenterLocale
  activeSection: KnowledgeMainSection
  sidebar: KnowledgeSidebarNav
  smartPanel: KnowledgeSmartPanel
  organization: KnowledgeOrganizationKind
  filters: KnowledgeSearchFilters
  documents: KnowledgeDocument[]
  recentIds: string[]
  reader: KnowledgeReaderState
  featureEnabled: boolean
}

export const KNOWLEDGE_MAIN_SECTIONS: readonly KnowledgeMainSection[] = [
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
] as const

export const KNOWLEDGE_DOCUMENT_TYPES: readonly KnowledgeDocumentType[] = [
  'pdf',
  'book',
  'markdown',
  'image',
  'travel_document',
  'map',
  'video',
  'audio',
] as const

export const KNOWLEDGE_ORGANIZATIONS: readonly KnowledgeOrganizationKind[] = [
  'collections',
  'folders',
  'countries',
  'topics',
  'executive',
  'personal',
  'travel_planning',
  'visas',
  'hotels',
  'flights',
] as const

export const KNOWLEDGE_SMART_PANELS: readonly KnowledgeSmartPanel[] = [
  'recently_opened',
  'recommended',
  'popular',
  'favorites',
  'downloads',
  'offline',
] as const

export const KNOWLEDGE_SIDEBAR_NAV: readonly KnowledgeSidebarNav[] = [
  'navigation',
  'collections',
  'countries',
  'search',
  'pinned',
  'recent',
  'favorites',
] as const

export const KNOWLEDGE_DOCUMENT_ACTIONS: readonly KnowledgeDocumentAction[] = [
  'open',
  'preview',
  'favorite',
  'bookmark',
  'share',
  'download',
  'print',
] as const

/** Isolation: Knowledge is a separate destination — never inside Chat or Voice. */
export const KNOWLEDGE_CENTER_ISOLATION = {
  embeddedInChat: false,
  embeddedInVoice: false,
  booksOnlyInKnowledge: true,
  knowledgeLoading: false,
  embeddings: false,
  vectorDatabase: false,
  rag: false,
  searchApis: false,
  cloudStorage: false,
  ocr: false,
  aiAnalysis: false,
  backend: false,
  aiCalls: false,
  runtimeCoordinator: false,
  conversationOrchestrator: false,
  voiceCenterWiring: false,
} as const
