import type { QuickActionId, TravelWorkspaceLocale } from '../types'
import { QUICK_ACTIONS } from '../types'

const LABELS: Record<QuickActionId, { ar: string; en: string }> = {
  open_chat: { ar: 'فتح المحادثة', en: 'Open Chat' },
  open_voice: { ar: 'فتح الصوت', en: 'Open Voice' },
  open_knowledge: { ar: 'فتح المعرفة', en: 'Open Knowledge' },
  view_documents: { ar: 'عرض المستندات', en: 'View Documents' },
  open_maps: { ar: 'فتح الخرائط', en: 'Open Maps' },
  contact_support: { ar: 'الدعم', en: 'Contact Support' },
  share_trip: { ar: 'مشاركة الرحلة', en: 'Share Trip' },
  export_pdf: { ar: 'تصدير PDF', en: 'Export PDF' },
}

/**
 * Quick action buttons only — navigate later.
 * Must not embed Chat / Voice / Knowledge / Maps runtimes here.
 */
export function QuickActions({
  locale = 'ar',
  onAction,
}: {
  locale?: TravelWorkspaceLocale
  onAction?: (id: QuickActionId) => void
}) {
  return (
    <section data-testid="tw-quick-actions" className="rahhal-tw-quick">
      <h2>{locale === 'en' ? 'Quick actions' : 'إجراءات سريعة'}</h2>
      <div className="rahhal-tw-quick__row">
        {QUICK_ACTIONS.map((id) => (
          <button
            key={id}
            type="button"
            data-quick-action={id}
            data-testid={`tw-action-${id}`}
            onClick={() => onAction?.(id)}
          >
            {locale === 'en' ? LABELS[id].en : LABELS[id].ar}
          </button>
        ))}
      </div>
    </section>
  )
}
