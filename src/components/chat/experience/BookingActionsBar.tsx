import { memo } from 'react'
import type { ConversationBookingAction } from '../../../lib/chat/conversationExperienceUi'

interface Props {
  onAction: (action: ConversationBookingAction) => void
  busy?: boolean
  disabledActions?: ConversationBookingAction[]
}

const ACTIONS: Array<{ id: ConversationBookingAction; label: string }> = [
  { id: 'reserve', label: 'Reserve' },
  { id: 'pay', label: 'Pay' },
  { id: 'cancel', label: 'Cancel' },
  { id: 'refund', label: 'Refund' },
  { id: 'view_documents', label: 'View Documents' },
  { id: 'open_trip', label: 'Open Trip' },
]

function BookingActionsBarImpl({ onAction, busy, disabledActions = [] }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Booking actions">
      {ACTIONS.map((action) => {
        const disabled = busy || disabledActions.includes(action.id)
        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            onClick={() => onAction(action.id)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            {action.label}
          </button>
        )
      })}
    </div>
  )
}

export default memo(BookingActionsBarImpl)
