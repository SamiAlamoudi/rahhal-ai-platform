import type {
  VoiceCenterLocale,
  VoiceTranscriptEntry,
} from '../types'

export interface TranscriptPanelProps {
  entries: VoiceTranscriptEntry[]
  currentTravelerText: string
  currentAssistantText: string
  locale?: VoiceCenterLocale
  onToggleExpand?: (id: string) => void
  onCopy?: (id: string) => void
  onExportPlaceholder?: () => void
}

/**
 * Traveler / assistant transcript area with confidence, timestamps,
 * expand/copy, and export placeholder. No STT stream.
 */
export function TranscriptPanel({
  entries,
  currentTravelerText,
  currentAssistantText,
  locale = 'ar',
  onToggleExpand,
  onCopy,
  onExportPlaceholder,
}: TranscriptPanelProps) {
  return (
    <section className="rahhal-vc-transcript" data-testid="vc-transcript">
      <header className="rahhal-vc-transcript__header">
        <h2>{locale === 'en' ? 'Transcript' : 'النص'}</h2>
        <button
          type="button"
          data-testid="vc-export-placeholder"
          data-placeholder="true"
          onClick={onExportPlaceholder}
        >
          {locale === 'en' ? 'Export' : 'تصدير'}
        </button>
      </header>

      <div className="rahhal-vc-transcript__live" data-testid="vc-live-areas">
        <div className="rahhal-vc-transcript__current" data-testid="vc-current-traveler">
          <span className="rahhal-vc-transcript__role">
            {locale === 'en' ? 'Traveler' : 'المسافر'}
          </span>
          <p>{currentTravelerText || (locale === 'en' ? '—' : '—')}</p>
        </div>
        <div className="rahhal-vc-transcript__current" data-testid="vc-current-assistant">
          <span className="rahhal-vc-transcript__role">
            {locale === 'en' ? 'Assistant' : 'المساعد'}
          </span>
          <p>{currentAssistantText || (locale === 'en' ? '—' : '—')}</p>
        </div>
      </div>

      <ol className="rahhal-vc-transcript__list" data-testid="vc-transcript-list">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`rahhal-vc-transcript__item rahhal-vc-transcript__item--${entry.role}${
              entry.expanded ? ' is-expanded' : ''
            }`}
            data-transcript-id={entry.id}
            data-role={entry.role}
          >
            <div className="rahhal-vc-transcript__meta">
              <span>{entry.role === 'traveler' ? (locale === 'en' ? 'Traveler' : 'المسافر') : locale === 'en' ? 'Assistant' : 'المساعد'}</span>
              <time dateTime={entry.createdAt}>{formatTime(entry.createdAt, locale)}</time>
              {entry.confidence != null ? (
                <span data-testid="vc-confidence">
                  {locale === 'en' ? 'Confidence' : 'ثقة'}{' '}
                  {Math.round(entry.confidence * 100)}%
                </span>
              ) : null}
            </div>
            <p className="rahhal-vc-transcript__text">
              {entry.expanded || entry.text.length <= 120
                ? entry.text
                : `${entry.text.slice(0, 120)}…`}
            </p>
            <div className="rahhal-vc-transcript__actions">
              <button
                type="button"
                data-testid="vc-transcript-expand"
                onClick={() => onToggleExpand?.(entry.id)}
              >
                {entry.expanded
                  ? locale === 'en'
                    ? 'Collapse'
                    : 'طيّ'
                  : locale === 'en'
                    ? 'Expand'
                    : 'توسيع'}
              </button>
              <button
                type="button"
                data-testid="vc-transcript-copy"
                onClick={() => onCopy?.(entry.id)}
              >
                {locale === 'en' ? 'Copy' : 'نسخ'}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function formatTime(iso: string, locale: VoiceCenterLocale): string {
  try {
    return new Date(iso).toLocaleTimeString(locale === 'en' ? 'en' : 'ar', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
