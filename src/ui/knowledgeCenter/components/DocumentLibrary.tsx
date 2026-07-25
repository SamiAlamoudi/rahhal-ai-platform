import type {
  KnowledgeCenterLocale,
  KnowledgeDocument,
  KnowledgeDocumentAction,
  KnowledgeDocumentType,
  KnowledgeSearchFilters,
} from '../types'
import { KNOWLEDGE_DOCUMENT_ACTIONS, KNOWLEDGE_DOCUMENT_TYPES } from '../types'

export interface DocumentLibraryProps {
  documents: KnowledgeDocument[]
  filters: KnowledgeSearchFilters
  locale?: KnowledgeCenterLocale
  onFiltersChange: (filters: KnowledgeSearchFilters) => void
  onAction: (action: KnowledgeDocumentAction, documentId: string) => void
}

const TYPE_LABEL: Record<KnowledgeDocumentType, { ar: string; en: string }> = {
  pdf: { ar: 'PDF', en: 'PDF' },
  book: { ar: 'كتاب', en: 'Book' },
  markdown: { ar: 'Markdown', en: 'Markdown' },
  image: { ar: 'صورة', en: 'Image' },
  travel_document: { ar: 'مستند سفر', en: 'Travel document' },
  map: { ar: 'خريطة', en: 'Map' },
  video: { ar: 'فيديو', en: 'Video' },
  audio: { ar: 'صوت', en: 'Audio' },
}

const ACTION_LABEL: Record<KnowledgeDocumentAction, { ar: string; en: string }> = {
  open: { ar: 'فتح', en: 'Open' },
  preview: { ar: 'معاينة', en: 'Preview' },
  favorite: { ar: 'مفضلة', en: 'Favorite' },
  bookmark: { ar: 'إشارة', en: 'Bookmark' },
  share: { ar: 'مشاركة', en: 'Share' },
  download: { ar: 'تنزيل', en: 'Download' },
  print: { ar: 'طباعة', en: 'Print' },
}

/** Document grid with filters/categories — no search APIs or cloud storage. */
export function DocumentLibrary({
  documents,
  filters,
  locale = 'ar',
  onFiltersChange,
  onAction,
}: DocumentLibraryProps) {
  return (
    <section className="rahhal-kc-library" data-testid="kc-document-library">
      <div className="rahhal-kc-library__filters" data-testid="kc-filters">
        <select
          data-testid="kc-filter-type"
          value={filters.type}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              type: e.target.value as KnowledgeSearchFilters['type'],
            })
          }
        >
          <option value="all">{locale === 'en' ? 'All types' : 'كل الأنواع'}</option>
          {KNOWLEDGE_DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {locale === 'en' ? TYPE_LABEL[type].en : TYPE_LABEL[type].ar}
            </option>
          ))}
        </select>

        <select
          data-testid="kc-filter-country"
          value={filters.country}
          onChange={(e) =>
            onFiltersChange({ ...filters, country: e.target.value as KnowledgeSearchFilters['country'] })
          }
        >
          <option value="all">{locale === 'en' ? 'All countries' : 'كل الدول'}</option>
          <option value="SA">SA</option>
          <option value="AE">AE</option>
          <option value="FR">FR</option>
        </select>

        <select
          data-testid="kc-filter-language"
          value={filters.language}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              language: e.target.value as KnowledgeSearchFilters['language'],
            })
          }
        >
          <option value="all">{locale === 'en' ? 'All languages' : 'كل اللغات'}</option>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>

        <label>
          <input
            type="checkbox"
            data-testid="kc-filter-favorites"
            checked={filters.showFavorites}
            onChange={(e) =>
              onFiltersChange({ ...filters, showFavorites: e.target.checked })
            }
          />
          {locale === 'en' ? 'Favorites' : 'المفضلة'}
        </label>

        <label>
          <input
            type="checkbox"
            data-testid="kc-filter-bookmarks"
            checked={filters.showBookmarks}
            onChange={(e) =>
              onFiltersChange({ ...filters, showBookmarks: e.target.checked })
            }
          />
          {locale === 'en' ? 'Bookmarks' : 'الإشارات'}
        </label>

        <label>
          <input
            type="checkbox"
            data-testid="kc-filter-recent"
            checked={filters.showRecent}
            onChange={(e) =>
              onFiltersChange({ ...filters, showRecent: e.target.checked })
            }
          />
          {locale === 'en' ? 'Recent' : 'الأخيرة'}
        </label>
      </div>

      <ul className="rahhal-kc-library__grid" data-testid="kc-document-grid">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="rahhal-kc-doc"
            data-testid="kc-document"
            data-doc-id={doc.id}
            data-doc-type={doc.type}
            data-section={doc.section}
          >
            <div className="rahhal-kc-doc__meta">
              <span className="rahhal-kc-doc__type">
                {locale === 'en' ? TYPE_LABEL[doc.type].en : TYPE_LABEL[doc.type].ar}
              </span>
              <h3>{doc.title}</h3>
              <p>{doc.preview}</p>
              {doc.tags.length > 0 ? (
                <div className="rahhal-kc-doc__tags" data-testid="kc-tags">
                  {doc.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rahhal-kc-doc__actions" data-testid="kc-doc-actions">
              {KNOWLEDGE_DOCUMENT_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  data-action={action}
                  data-placeholder={
                    action === 'share' || action === 'download' || action === 'print'
                      ? 'true'
                      : 'false'
                  }
                  onClick={() => onAction(action, doc.id)}
                >
                  {locale === 'en' ? ACTION_LABEL[action].en : ACTION_LABEL[action].ar}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
