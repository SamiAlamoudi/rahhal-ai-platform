import type {
  VoiceCenterLocale,
  VoiceHistoryBucket,
  VoiceSessionSummary,
} from '../types'
import { VOICE_HISTORY_BUCKETS } from '../types'

export interface SessionHistoryProps {
  sessions: VoiceSessionSummary[]
  activeSessionId: string | null
  bucket: VoiceHistoryBucket
  searchQuery: string
  locale?: VoiceCenterLocale
  onBucketChange: (bucket: VoiceHistoryBucket) => void
  onSearchChange: (query: string) => void
  onSelect: (id: string) => void
  onRename?: (id: string) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onFavorite?: (id: string) => void
}

const BUCKET_LABEL: Record<VoiceHistoryBucket, { ar: string; en: string }> = {
  recent: { ar: 'الأخيرة', en: 'Recent' },
  favorites: { ar: 'المفضلة', en: 'Favorites' },
  archived: { ar: 'مؤرشفة', en: 'Archived' },
}

/** Voice session history — separate from Chat conversation history. */
export function SessionHistory({
  sessions,
  activeSessionId,
  bucket,
  searchQuery,
  locale = 'ar',
  onBucketChange,
  onSearchChange,
  onSelect,
  onRename,
  onArchive,
  onDelete,
  onFavorite,
}: SessionHistoryProps) {
  return (
    <aside className="rahhal-vc-history" data-testid="vc-session-history">
      <h2>{locale === 'en' ? 'Voice sessions' : 'جلسات الصوت'}</h2>

      <input
        type="search"
        data-testid="vc-session-search"
        value={searchQuery}
        placeholder={locale === 'en' ? 'Search…' : 'بحث…'}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <nav className="rahhal-vc-history__buckets" data-testid="vc-history-buckets">
        {VOICE_HISTORY_BUCKETS.map((id) => (
          <button
            key={id}
            type="button"
            data-bucket={id}
            className={bucket === id ? 'is-active' : undefined}
            aria-pressed={bucket === id}
            onClick={() => onBucketChange(id)}
          >
            {locale === 'en' ? BUCKET_LABEL[id].en : BUCKET_LABEL[id].ar}
          </button>
        ))}
      </nav>

      <ul className="rahhal-vc-history__list" data-testid="vc-session-list">
        {sessions.map((session) => (
          <li
            key={session.id}
            data-session-id={session.id}
            className={session.id === activeSessionId ? 'is-active' : undefined}
          >
            <button type="button" onClick={() => onSelect(session.id)}>
              <strong>{session.title}</strong>
              <span>{session.preview}</span>
            </button>
            <div className="rahhal-vc-history__actions">
              <button type="button" data-action="favorite" onClick={() => onFavorite?.(session.id)}>
                {locale === 'en' ? 'Favorite' : 'مفضلة'}
              </button>
              <button type="button" data-action="rename" onClick={() => onRename?.(session.id)}>
                {locale === 'en' ? 'Rename' : 'إعادة تسمية'}
              </button>
              <button type="button" data-action="archive" onClick={() => onArchive?.(session.id)}>
                {locale === 'en' ? 'Archive' : 'أرشفة'}
              </button>
              <button type="button" data-action="delete" onClick={() => onDelete?.(session.id)}>
                {locale === 'en' ? 'Delete' : 'حذف'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
