import type { ConversationMessageKind } from '../../types'
import { isConversationCardKind } from '../../types'

const CARD_LABELS: Partial<Record<ConversationMessageKind, { ar: string; en: string }>> = {
  destination_card: { ar: 'وجهة', en: 'Destination' },
  hotel_card: { ar: 'فندق', en: 'Hotel' },
  flight_card: { ar: 'رحلة طيران', en: 'Flight' },
  transportation_card: { ar: 'تنقل', en: 'Transportation' },
  visa_card: { ar: 'تأشيرة', en: 'Visa' },
  weather_card: { ar: 'طقس', en: 'Weather' },
  budget_card: { ar: 'ميزانية', en: 'Budget' },
  checklist_card: { ar: 'قائمة تحقق', en: 'Checklist' },
  action_card: { ar: 'إجراء', en: 'Action' },
  expandable_card: { ar: 'بطاقة قابلة للتوسيع', en: 'Expandable' },
  timeline: { ar: 'جدول زمني', en: 'Timeline' },
  executive_summary: { ar: 'ملخص تنفيذي', en: 'Executive summary' },
  travel_plan: { ar: 'خطة سفر', en: 'Travel plan' },
}

export interface TravelCardProps {
  kind: ConversationMessageKind
  title?: string | null
  subtitle?: string
  expanded?: boolean
  locale?: 'ar' | 'en'
  onToggleExpand?: () => void
}

/**
 * Placeholder travel / content cards — presentation only.
 * No booking, maps, payments, or live data.
 */
export function TravelCard({
  kind,
  title,
  subtitle,
  expanded = false,
  locale = 'ar',
  onToggleExpand,
}: TravelCardProps) {
  if (!isConversationCardKind(kind)) return null
  const labels = CARD_LABELS[kind]
  const label = labels ? (locale === 'en' ? labels.en : labels.ar) : kind
  const expandable = kind === 'expandable_card' || onToggleExpand != null

  return (
    <article
      className={`rahhal-cc-card rahhal-cc-card--${kind}${expanded ? ' is-expanded' : ''}`}
      data-testid={`cc-card-${kind}`}
      data-card-kind={kind}
    >
      <header className="rahhal-cc-card__header">
        <span className="rahhal-cc-card__badge">{label}</span>
        {title ? <h3 className="rahhal-cc-card__title">{title}</h3> : null}
        {subtitle ? <p className="rahhal-cc-card__subtitle">{subtitle}</p> : null}
        {expandable ? (
          <button
            type="button"
            className="rahhal-cc-card__expand"
            data-testid="cc-card-expand"
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            {expanded ? (locale === 'en' ? 'Collapse' : 'طيّ') : locale === 'en' ? 'Expand' : 'توسيع'}
          </button>
        ) : null}
      </header>
      {expanded ? (
        <div className="rahhal-cc-card__body" data-testid="cc-card-body">
          <p className="rahhal-cc-card__placeholder">
            {locale === 'en' ? 'Card content — UI only.' : 'محتوى البطاقة — واجهة فقط.'}
          </p>
        </div>
      ) : null}
    </article>
  )
}
