import { isKnowledgeCenterEnabled } from '../knowledgeCenterRegistry'
import type {
  KnowledgeCenterLocale,
  KnowledgeCenterUiState,
  KnowledgeDocument,
  KnowledgeMainSection,
  KnowledgeSearchFilters,
} from '../types'
import { KNOWLEDGE_CENTER_ISOLATION } from '../types'

export function createDefaultFilters(): KnowledgeSearchFilters {
  return {
    query: '',
    section: 'all',
    type: 'all',
    country: 'all',
    language: 'all',
    tag: 'all',
    showBookmarks: false,
    showFavorites: false,
    showRecent: false,
  }
}

export function createInitialKnowledgeCenterState(options?: {
  locale?: KnowledgeCenterLocale
  enabled?: boolean
  documents?: KnowledgeDocument[]
  activeSection?: KnowledgeMainSection
  recentIds?: string[]
}): KnowledgeCenterUiState {
  return {
    locale: options?.locale ?? 'ar',
    activeSection: options?.activeSection ?? 'travel_guides',
    sidebar: 'navigation',
    smartPanel: 'recently_opened',
    organization: 'collections',
    filters: createDefaultFilters(),
    documents: options?.documents ?? [],
    recentIds: options?.recentIds ?? [],
    reader: {
      mode: 'none',
      documentId: null,
      zoom: 1,
      fullscreen: false,
      progress: 0,
      notesPlaceholder: true,
      highlightsPlaceholder: true,
    },
    featureEnabled: isKnowledgeCenterEnabled({ enabled: options?.enabled }),
  }
}

export function filterKnowledgeDocuments(
  documents: KnowledgeDocument[],
  filters: KnowledgeSearchFilters,
  recentIds: string[],
  activeSection?: KnowledgeMainSection,
): KnowledgeDocument[] {
  const q = filters.query.trim().toLowerCase()
  return documents.filter((doc) => {
    if (activeSection && doc.section !== activeSection && activeSection !== 'books') {
      // When browsing a section, prefer that section unless global search is active
      if (!q && filters.section === 'all') {
        if (doc.section !== activeSection) return false
      }
    }
    if (activeSection === 'books' && filters.section === 'all' && !q) {
      if (doc.section !== 'books' && doc.type !== 'book') return false
    }
    if (filters.section !== 'all' && doc.section !== filters.section) return false
    if (filters.type !== 'all' && doc.type !== filters.type) return false
    if (filters.country !== 'all' && doc.country !== filters.country) return false
    if (filters.language !== 'all' && doc.language !== filters.language) return false
    if (filters.tag !== 'all' && !doc.tags.includes(filters.tag)) return false
    if (filters.showBookmarks && !doc.bookmarked) return false
    if (filters.showFavorites && !doc.favorite) return false
    if (filters.showRecent && !recentIds.includes(doc.id)) return false
    if (!q) return true
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.preview.toLowerCase().includes(q) ||
      doc.tags.some((t) => t.toLowerCase().includes(q))
    )
  })
}

export function createDemoDocument(
  partial: Partial<KnowledgeDocument> &
    Pick<KnowledgeDocument, 'id' | 'title' | 'section' | 'type'>,
): KnowledgeDocument {
  return {
    country: partial.country ?? null,
    language: partial.language ?? 'ar',
    tags: partial.tags ?? [],
    favorite: partial.favorite ?? false,
    bookmarked: partial.bookmarked ?? false,
    pinned: partial.pinned ?? false,
    organization: partial.organization ?? ['collections'],
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
    preview: partial.preview ?? '',
    ...partial,
  }
}

export function assertKnowledgeCenterIsolation(): typeof KNOWLEDGE_CENTER_ISOLATION & {
  ownDestination: boolean
  notInsideChat: boolean
  notInsideVoice: boolean
} {
  return {
    ...KNOWLEDGE_CENTER_ISOLATION,
    ownDestination: true,
    notInsideChat: !KNOWLEDGE_CENTER_ISOLATION.embeddedInChat,
    notInsideVoice: !KNOWLEDGE_CENTER_ISOLATION.embeddedInVoice,
  }
}
