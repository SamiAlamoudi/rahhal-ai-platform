/**
 * Phase 4 Stage 4 — Knowledge Center root.
 * Own destination — not inside Chat or Voice.
 * No RAG / embeddings / search APIs / OCR / AI / backend.
 */

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import './knowledgeCenter.css'
import { knowledgeTokenCssVariables } from '../design/knowledgeTokens'
import { isKnowledgeCenterEnabled } from '../knowledgeCenterRegistry'
import {
  createInitialKnowledgeCenterState,
  filterKnowledgeDocuments,
} from '../state/knowledgeCenterState'
import type {
  KnowledgeCenterLocale,
  KnowledgeCenterUiState,
  KnowledgeDocumentAction,
  KnowledgeDocumentType,
  KnowledgeMainSection,
  KnowledgeReaderMode,
} from '../types'
import { BooksSection } from './BooksSection'
import { DocumentLibrary } from './DocumentLibrary'
import { KnowledgeReader } from './KnowledgeReader'
import { KnowledgeSidebar } from './KnowledgeSidebar'
import { OrganizationBar } from './OrganizationBar'
import { SmartPanels } from './SmartPanels'

export interface KnowledgeCenterProps {
  /** Force-enable for tests / demos without registry. */
  enabled?: boolean
  locale?: KnowledgeCenterLocale
  initialState?: Partial<KnowledgeCenterUiState>
}

function readerModeForType(type: KnowledgeDocumentType): KnowledgeReaderMode {
  if (type === 'pdf' || type === 'travel_document' || type === 'markdown') return 'pdf'
  if (type === 'book') return 'book'
  if (type === 'image' || type === 'map') return 'image'
  return 'pdf'
}

export function KnowledgeCenter({
  enabled,
  locale = 'ar',
  initialState,
}: KnowledgeCenterProps) {
  const knowledgeOn = isKnowledgeCenterEnabled({ enabled })
  const [state, setState] = useState<KnowledgeCenterUiState>(() =>
    createInitialKnowledgeCenterState({
      locale: initialState?.locale ?? locale,
      enabled,
      documents: initialState?.documents,
      activeSection: initialState?.activeSection,
      recentIds: initialState?.recentIds,
    }),
  )

  const cssVars = useMemo(() => knowledgeTokenCssVariables() as CSSProperties, [])

  if (!knowledgeOn) return null

  const visible = filterKnowledgeDocuments(
    state.documents,
    state.filters,
    state.recentIds,
    state.activeSection,
  )

  const books = state.documents.filter(
    (d) => d.section === 'books' || d.type === 'book',
  )

  const openDoc =
    state.reader.documentId != null
      ? (state.documents.find((d) => d.id === state.reader.documentId) ?? null)
      : null

  const onAction = (action: KnowledgeDocumentAction, documentId: string) => {
    const doc = state.documents.find((d) => d.id === documentId)
    if (!doc) return

    if (action === 'open' || action === 'preview') {
      setState((prev) => ({
        ...prev,
        recentIds: [documentId, ...prev.recentIds.filter((id) => id !== documentId)].slice(
          0,
          20,
        ),
        reader: {
          ...prev.reader,
          mode: readerModeForType(doc.type),
          documentId,
          progress: action === 'preview' ? 10 : prev.reader.progress,
        },
      }))
      return
    }

    if (action === 'favorite' || action === 'bookmark') {
      setState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => {
          if (d.id !== documentId) return d
          if (action === 'favorite') return { ...d, favorite: !d.favorite }
          return { ...d, bookmarked: !d.bookmarked }
        }),
      }))
    }
    // share / download / print — placeholders only
  }

  return (
    <div
      className="rahhal-kc"
      data-testid="knowledge-center"
      data-kc="knowledge-center"
      data-locale={state.locale}
      data-section={state.activeSection}
      dir={state.locale === 'ar' ? 'rtl' : 'ltr'}
      style={cssVars}
    >
      <KnowledgeSidebar
        locale={state.locale}
        activeSection={state.activeSection}
        sidebar={state.sidebar}
        searchQuery={state.filters.query}
        onSectionChange={(section: KnowledgeMainSection) =>
          setState((prev) => ({
            ...prev,
            activeSection: section,
            filters: {
              ...prev.filters,
              section: section === 'books' ? 'books' : 'all',
            },
          }))
        }
        onSidebarChange={(sidebar) => setState((prev) => ({ ...prev, sidebar }))}
        onSearchChange={(query) =>
          setState((prev) => ({
            ...prev,
            filters: { ...prev.filters, query },
          }))
        }
      />

      <main className="rahhal-kc-main" data-testid="kc-main">
        <SmartPanels
          active={state.smartPanel}
          locale={state.locale}
          onChange={(smartPanel) => setState((prev) => ({ ...prev, smartPanel }))}
        />

        <OrganizationBar
          active={state.organization}
          locale={state.locale}
          onChange={(organization) => setState((prev) => ({ ...prev, organization }))}
        />

        {state.activeSection === 'books' ? (
          <BooksSection
            books={books}
            locale={state.locale}
            onOpen={(id) => onAction('open', id)}
          />
        ) : (
          <DocumentLibrary
            documents={visible}
            filters={state.filters}
            locale={state.locale}
            onFiltersChange={(filters) => setState((prev) => ({ ...prev, filters }))}
            onAction={onAction}
          />
        )}

        <KnowledgeReader
          reader={state.reader}
          document={openDoc}
          locale={state.locale}
          onZoomChange={(zoom) =>
            setState((prev) => ({ ...prev, reader: { ...prev.reader, zoom } }))
          }
          onToggleFullscreen={() =>
            setState((prev) => ({
              ...prev,
              reader: { ...prev.reader, fullscreen: !prev.reader.fullscreen },
            }))
          }
          onProgressChange={(progress) =>
            setState((prev) => ({
              ...prev,
              reader: { ...prev.reader, progress },
            }))
          }
          onClose={() =>
            setState((prev) => ({
              ...prev,
              reader: {
                ...prev.reader,
                mode: 'none',
                documentId: null,
                fullscreen: false,
              },
            }))
          }
          onBookmark={() => {
            if (state.reader.documentId) onAction('bookmark', state.reader.documentId)
          }}
        />
      </main>
    </div>
  )
}

/** Safe render helper for tests — returns null when flag OFF. */
export function tryRenderKnowledgeCenter(
  props: KnowledgeCenterProps = {},
): ReactElement | null {
  if (!isKnowledgeCenterEnabled({ enabled: props.enabled })) return null
  return <KnowledgeCenter {...props} />
}
