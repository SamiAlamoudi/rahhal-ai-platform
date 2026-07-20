import { memo } from 'react'
import type { ConversationTimelineEvent } from '../../../lib/chat/conversationExperienceUi'

interface Props {
  events: ConversationTimelineEvent[]
  onOpen?: (event: ConversationTimelineEvent) => void
}

function TripTimelinePanelImpl({ events, onOpen }: Props) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700">
        No trip timeline events yet
      </div>
    )
  }

  return (
    <ol className="space-y-2" aria-label="Trip timeline">
      {events.map((event) => (
        <li key={event.id}>
          <button
            type="button"
            onClick={() => onOpen?.(event)}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-start hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <span className="mt-0.5 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-800 dark:bg-primary-950 dark:text-primary-200">
              {event.status}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{event.title}</span>
              <span className="block truncate text-[11px] text-slate-500">{event.detail}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export default memo(TripTimelinePanelImpl)
