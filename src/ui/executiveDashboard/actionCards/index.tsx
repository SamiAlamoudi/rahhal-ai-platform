import type { ActionCardId, ExecutiveLocale } from '../types'
import { ACTION_CARDS } from '../types'

const LABELS: Record<ActionCardId, { ar: string; en: string }> = {
  view_trip: { ar: 'عرض الرحلة', en: 'View Trip' },
  view_traveler: { ar: 'عرض المسافر', en: 'View Traveler' },
  open_timeline: { ar: 'فتح الجدول', en: 'Open Timeline' },
  open_documents: { ar: 'فتح المستندات', en: 'Open Documents' },
  open_calendar: { ar: 'فتح التقويم', en: 'Open Calendar' },
}

/** Action cards — UI buttons only; no navigation wiring to production. */
export function ActionCards({
  locale = 'ar',
  onAction,
}: {
  locale?: ExecutiveLocale
  onAction?: (id: ActionCardId) => void
}) {
  return (
    <section data-testid="ed-action-cards" className="rahhal-ed-actions">
      {ACTION_CARDS.map((id) => (
        <button
          key={id}
          type="button"
          data-action={id}
          data-placeholder={id === 'open_calendar' ? 'true' : 'false'}
          onClick={() => onAction?.(id)}
        >
          {locale === 'en' ? LABELS[id].en : LABELS[id].ar}
        </button>
      ))}
    </section>
  )
}
