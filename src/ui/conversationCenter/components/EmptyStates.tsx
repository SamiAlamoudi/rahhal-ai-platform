import type { ConversationEmptyStateKind } from '../types'

const COPY: Record<
  ConversationEmptyStateKind,
  { titleAr: string; bodyAr: string; titleEn: string; bodyEn: string }
> = {
  first_conversation: {
    titleAr: 'ابدأ محادثة جديدة',
    bodyAr: 'رحّال جاهز لمساعدتك في تخطيط رحلتك. اكتب وجهتك أو سؤالك أدناه.',
    titleEn: 'Start a new conversation',
    bodyEn: 'Rahhal is ready to help plan your trip. Write a destination or question below.',
  },
  no_history: {
    titleAr: 'لا توجد محادثات هنا',
    bodyAr: 'لم نجد محادثات في هذا القسم بعد.',
    titleEn: 'No conversations here',
    bodyEn: 'Nothing in this sidebar section yet.',
  },
  no_search_results: {
    titleAr: 'لا نتائج',
    bodyAr: 'جرّب كلمات بحث مختلفة أو امسح البحث.',
    titleEn: 'No results',
    bodyEn: 'Try different keywords or clear search.',
  },
  offline: {
    titleAr: 'أنت غير متصل',
    bodyAr: 'تحقق من الاتصال — واجهة المحادثة جاهزة عند عودتك.',
    titleEn: 'You are offline',
    bodyEn: 'Check your connection — the conversation UI will be ready when you return.',
  },
  loading: {
    titleAr: 'جارٍ التحميل…',
    bodyAr: 'نحضر مساحة المحادثة.',
    titleEn: 'Loading…',
    bodyEn: 'Preparing the conversation space.',
  },
}

export interface EmptyStatesProps {
  kind: ConversationEmptyStateKind
  locale?: 'ar' | 'en'
}

/** Empty / status states for Conversation Center (UI only). */
export function EmptyStates({ kind, locale = 'ar' }: EmptyStatesProps) {
  const copy = COPY[kind]
  const title = locale === 'en' ? copy.titleEn : copy.titleAr
  const body = locale === 'en' ? copy.bodyEn : copy.bodyAr
  return (
    <div
      className={`rahhal-cc-empty rahhal-cc-empty--${kind}`}
      data-testid="cc-empty"
      data-empty-kind={kind}
      role="status"
    >
      <h2 className="rahhal-cc-empty__title">{title}</h2>
      <p className="rahhal-cc-empty__body">{body}</p>
    </div>
  )
}
