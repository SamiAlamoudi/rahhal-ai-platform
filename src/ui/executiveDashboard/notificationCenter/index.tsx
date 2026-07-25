import { useMemo, useState } from 'react'
import { filterNotifications } from '../state/executiveDashboardState'
import type {
  ExecutiveLocale,
  NotificationCategory,
  NotificationItem,
  NotificationPriority,
  NotificationReadState,
} from '../types'
import { NOTIFICATION_CATEGORIES } from '../types'

export interface NotificationCenterProps {
  notifications: NotificationItem[]
  locale?: ExecutiveLocale
  onMarkRead?: (id: string) => void
}

/**
 * Notification Center — timeline UI only.
 * No push, realtime, Firebase, or backend delivery.
 */
export function NotificationCenter({
  notifications,
  locale = 'ar',
  onMarkRead,
}: NotificationCenterProps) {
  const [readState, setReadState] = useState<NotificationReadState | 'all'>('all')
  const [priority, setPriority] = useState<NotificationPriority | 'all'>('all')
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all')

  const visible = useMemo(
    () =>
      filterNotifications(notifications, {
        readState,
        priority,
        category,
      }),
    [notifications, readState, priority, category],
  )

  return (
    <aside
      className="rahhal-ed-notifications"
      data-testid="ed-notification-center"
      aria-label="notifications"
    >
      <header>
        <h2>{locale === 'en' ? 'Notification Center' : 'مركز الإشعارات'}</h2>
        <p data-testid="ed-notification-count">
          {notifications.filter((n) => n.readState === 'unread').length}{' '}
          {locale === 'en' ? 'unread' : 'غير مقروء'}
        </p>
      </header>

      <div className="rahhal-ed-notifications__filters" data-testid="ed-notification-filters">
        <select
          data-testid="ed-notif-read"
          value={readState}
          onChange={(e) =>
            setReadState(e.target.value as NotificationReadState | 'all')
          }
        >
          <option value="all">{locale === 'en' ? 'All' : 'الكل'}</option>
          <option value="unread">{locale === 'en' ? 'Unread' : 'غير مقروء'}</option>
          <option value="read">{locale === 'en' ? 'Read' : 'مقروء'}</option>
        </select>
        <select
          data-testid="ed-notif-priority"
          value={priority}
          onChange={(e) =>
            setPriority(e.target.value as NotificationPriority | 'all')
          }
        >
          <option value="all">{locale === 'en' ? 'Priority' : 'الأولوية'}</option>
          <option value="critical">{locale === 'en' ? 'Critical' : 'حرج'}</option>
          <option value="priority">{locale === 'en' ? 'Priority' : 'مهم'}</option>
          <option value="reminder">{locale === 'en' ? 'Reminder' : 'تذكير'}</option>
          <option value="normal">{locale === 'en' ? 'Normal' : 'عادي'}</option>
        </select>
        <select
          data-testid="ed-notif-category"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as NotificationCategory | 'all')
          }
        >
          <option value="all">{locale === 'en' ? 'Category' : 'الفئة'}</option>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <ol className="rahhal-ed-notifications__timeline" data-testid="ed-notification-timeline">
        {visible.map((n) => (
          <li
            key={n.id}
            data-testid="ed-notification"
            data-read={n.readState}
            data-priority={n.priority}
            data-category={n.category}
            className={`is-${n.priority} is-${n.readState}`}
          >
            <div>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <time dateTime={n.createdAt}>{n.createdAt}</time>
            </div>
            {n.readState === 'unread' ? (
              <button type="button" onClick={() => onMarkRead?.(n.id)}>
                {locale === 'en' ? 'Mark read' : 'تعليم كمقروء'}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </aside>
  )
}
