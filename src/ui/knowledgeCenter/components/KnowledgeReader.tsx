import type {
  KnowledgeCenterLocale,
  KnowledgeDocument,
  KnowledgeReaderState,
} from '../types'

export interface KnowledgeReaderProps {
  reader: KnowledgeReaderState
  document: KnowledgeDocument | null
  locale?: KnowledgeCenterLocale
  onZoomChange: (zoom: number) => void
  onToggleFullscreen: () => void
  onProgressChange: (progress: number) => void
  onClose: () => void
  onBookmark?: () => void
}

/**
 * Modern reader placeholders — PDF / Book / Image.
 * Zoom, fullscreen, progress, bookmarks, notes/highlights placeholders.
 * No OCR, cloud storage, or real PDF engine.
 */
export function KnowledgeReader({
  reader,
  document,
  locale = 'ar',
  onZoomChange,
  onToggleFullscreen,
  onProgressChange,
  onClose,
  onBookmark,
}: KnowledgeReaderProps) {
  if (reader.mode === 'none' || !document) {
    return (
      <div className="rahhal-kc-reader rahhal-kc-reader--empty" data-testid="kc-reader-empty">
        <p>
          {locale === 'en'
            ? 'Open a document to preview the reader.'
            : 'افتح مستنداً لمعاينة القارئ.'}
        </p>
      </div>
    )
  }

  return (
    <section
      className={`rahhal-kc-reader rahhal-kc-reader--${reader.mode}${
        reader.fullscreen ? ' is-fullscreen' : ''
      }`}
      data-testid="kc-reader"
      data-reader-mode={reader.mode}
      data-doc-id={document.id}
    >
      <header className="rahhal-kc-reader__toolbar" data-testid="kc-reader-toolbar">
        <strong>{document.title}</strong>
        <div className="rahhal-kc-reader__tools">
          <button
            type="button"
            data-testid="kc-reader-zoom-out"
            onClick={() => onZoomChange(Math.max(0.5, Number((reader.zoom - 0.1).toFixed(1))))}
          >
            −
          </button>
          <span data-testid="kc-reader-zoom">{Math.round(reader.zoom * 100)}%</span>
          <button
            type="button"
            data-testid="kc-reader-zoom-in"
            onClick={() => onZoomChange(Math.min(2, Number((reader.zoom + 0.1).toFixed(1))))}
          >
            +
          </button>
          <button
            type="button"
            data-testid="kc-reader-fullscreen"
            aria-pressed={reader.fullscreen}
            onClick={onToggleFullscreen}
          >
            {locale === 'en' ? 'Fullscreen' : 'ملء الشاشة'}
          </button>
          <button type="button" data-testid="kc-reader-bookmark" onClick={onBookmark}>
            {locale === 'en' ? 'Bookmark' : 'إشارة'}
          </button>
          <button type="button" data-testid="kc-reader-close" onClick={onClose}>
            {locale === 'en' ? 'Close' : 'إغلاق'}
          </button>
        </div>
      </header>

      <div
        className="rahhal-kc-reader__viewport"
        data-testid="kc-reader-viewport"
        style={{ transform: `scale(${reader.zoom})` }}
      >
        {reader.mode === 'pdf' ? (
          <div data-testid="kc-pdf-viewer-placeholder" className="rahhal-kc-reader__placeholder">
            {locale === 'en' ? 'PDF Viewer placeholder' : 'عارض PDF — واجهة فقط'}
          </div>
        ) : null}
        {reader.mode === 'book' ? (
          <div data-testid="kc-book-reader-placeholder" className="rahhal-kc-reader__placeholder">
            {locale === 'en' ? 'Book Reader placeholder' : 'قارئ الكتب — واجهة فقط'}
          </div>
        ) : null}
        {reader.mode === 'image' ? (
          <div data-testid="kc-image-viewer" className="rahhal-kc-reader__placeholder">
            {locale === 'en' ? 'Image Viewer' : 'عارض الصور'}
          </div>
        ) : null}
      </div>

      <footer className="rahhal-kc-reader__footer">
        <label>
          <span>{locale === 'en' ? 'Reading progress' : 'تقدم القراءة'}</span>
          <input
            type="range"
            min={0}
            max={100}
            data-testid="kc-reading-progress"
            value={reader.progress}
            onChange={(e) => onProgressChange(Number(e.target.value))}
          />
        </label>
        {reader.notesPlaceholder ? (
          <span data-testid="kc-notes-placeholder" data-placeholder="true">
            {locale === 'en' ? 'Notes' : 'ملاحظات'}
          </span>
        ) : null}
        {reader.highlightsPlaceholder ? (
          <span data-testid="kc-highlights-placeholder" data-placeholder="true">
            {locale === 'en' ? 'Highlights' : 'تمييز'}
          </span>
        ) : null}
      </footer>
    </section>
  )
}
