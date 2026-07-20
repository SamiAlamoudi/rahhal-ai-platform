import { memo } from 'react'
import type { ConversationLiveEvent } from '../../../lib/chat/conversationExperienceUi'

interface Props {
  events: ConversationLiveEvent[]
  onDismiss?: (id: string) => void
  onOpenTrip?: (tripId: string) => void
}

function LiveNotificationsBannerImpl({ events, onDismiss, onOpenTrip }: Props) {
  const unread = events.filter((e) => e.unread).slice(0, 3)
  if (!unread.length) return null

  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-label="Live trip notifications">
      {unread.map((event) => (
        <div
          key={event.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="min-w-0">
            <p className="font-semibold">{event.title}</p>
            <p className="text-xs opacity-90">{event.body}</p>
            {event.tripId && onOpenTrip && (
              <button
                type="button"
                className="mt-1 text-[11px] font-bold underline"
                onClick={() => onOpenTrip(event.tripId!)}
              >
                Open trip
              </button>
            )}
          </div>
          {onDismiss && (
            <button
              type="button"
              aria-label="Dismiss notification"
              className="text-xs font-bold"
              onClick={() => onDismiss(event.id)}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default memo(LiveNotificationsBannerImpl)
