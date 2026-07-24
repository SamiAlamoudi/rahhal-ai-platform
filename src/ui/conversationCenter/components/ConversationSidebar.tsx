import type {
  ConversationCenterLocale,
  ConversationCenterThread,
  ConversationListBucket,
  ConversationThreadActionId,
} from '../types'
import { CONVERSATION_SIDEBAR_BUCKETS } from '../types'

export interface ConversationSidebarProps {
  threads: ConversationCenterThread[]
  activeConversationId: string | null
  bucket: ConversationListBucket
  searchQuery: string
  locale?: ConversationCenterLocale
  onBucketChange: (bucket: ConversationListBucket) => void
  onSearchChange: (query: string) => void
  onSelectThread: (id: string) => void
  onThreadAction?: (action: ConversationThreadActionId, threadId: string) => void
  onNewConversation?: () => void
}

const BUCKET_LABEL: Record<ConversationListBucket, { ar: string; en: string }> = {
  recent: { ar: 'الأخيرة', en: 'Recent' },
  pinned: { ar: 'مثبّتة', en: 'Pinned' },
  favorites: { ar: 'المفضلة', en: 'Favorites' },
  archived: { ar: 'مؤرشفة', en: 'Archived' },
  drafts: { ar: 'مسودات', en: 'Drafts' },
  templates: { ar: 'قوالب', en: 'Templates' },
}

const THREAD_ACTIONS: ConversationThreadActionId[] = [
  'pin',
  'favorite',
  'archive',
  'rename',
  'delete',
  'export',
  'share',
]

const THREAD_ACTION_LABEL: Record<ConversationThreadActionId, { ar: string; en: string }> = {
  pin: { ar: 'تثبيت', en: 'Pin' },
  favorite: { ar: 'مفضلة', en: 'Favorite' },
  archive: { ar: 'أرشفة', en: 'Archive' },
  rename: { ar: 'إعادة تسمية', en: 'Rename' },
  delete: { ar: 'حذف', en: 'Delete' },
  export: { ar: 'تصدير', en: 'Export' },
  share: { ar: 'مشاركة', en: 'Share' },
}

/** Sidebar: history buckets, search, pin/archive/rename/delete + export/share placeholders. */
export function ConversationSidebar({
  threads,
  activeConversationId,
  bucket,
  searchQuery,
  locale = 'ar',
  onBucketChange,
  onSearchChange,
  onSelectThread,
  onThreadAction,
  onNewConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="rahhal-cc-sidebar" data-testid="cc-sidebar" aria-label="conversations">
      <div className="rahhal-cc-sidebar__header">
        <h2 className="rahhal-cc-sidebar__title">
          {locale === 'en' ? 'Conversations' : 'المحادثات'}
        </h2>
        <button
          type="button"
          className="rahhal-cc-sidebar__new"
          data-testid="cc-new-conversation"
          onClick={onNewConversation}
        >
          {locale === 'en' ? 'New' : 'جديدة'}
        </button>
      </div>

      <label className="rahhal-cc-sidebar__search">
        <span className="rahhal-cc-sr-only">
          {locale === 'en' ? 'Search conversations' : 'بحث المحادثات'}
        </span>
        <input
          type="search"
          data-testid="cc-search"
          value={searchQuery}
          placeholder={locale === 'en' ? 'Search…' : 'بحث…'}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>

      <nav className="rahhal-cc-sidebar__buckets" data-testid="cc-buckets">
        {CONVERSATION_SIDEBAR_BUCKETS.map((id) => (
          <button
            key={id}
            type="button"
            className={`rahhal-cc-sidebar__bucket${bucket === id ? ' is-active' : ''}`}
            data-bucket={id}
            aria-pressed={bucket === id}
            onClick={() => onBucketChange(id)}
          >
            {locale === 'en' ? BUCKET_LABEL[id].en : BUCKET_LABEL[id].ar}
          </button>
        ))}
      </nav>

      <ul className="rahhal-cc-sidebar__list" data-testid="cc-thread-list">
        {threads.map((thread) => (
          <li
            key={thread.id}
            className={`rahhal-cc-sidebar__item${
              thread.id === activeConversationId ? ' is-active' : ''
            }`}
            data-thread-id={thread.id}
            data-pinned={thread.pinned ? 'true' : 'false'}
            data-favorite={thread.favorite ? 'true' : 'false'}
          >
            <button
              type="button"
              className="rahhal-cc-sidebar__thread"
              onClick={() => onSelectThread(thread.id)}
            >
              <span className="rahhal-cc-sidebar__thread-title">{thread.title}</span>
              <span className="rahhal-cc-sidebar__thread-preview">{thread.preview}</span>
              {thread.unreadCount > 0 ? (
                <span className="rahhal-cc-sidebar__unread" data-testid="cc-unread">
                  {thread.unreadCount}
                </span>
              ) : null}
            </button>
            <div className="rahhal-cc-sidebar__actions" data-testid="cc-thread-actions">
              {THREAD_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  data-thread-action={action}
                  data-placeholder={
                    action === 'export' || action === 'share' ? 'true' : 'false'
                  }
                  onClick={() => onThreadAction?.(action, thread.id)}
                >
                  {locale === 'en'
                    ? THREAD_ACTION_LABEL[action].en
                    : THREAD_ACTION_LABEL[action].ar}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
