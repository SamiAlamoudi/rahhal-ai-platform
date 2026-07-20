import { memo } from 'react'
import type { ConversationSuggestedAction } from '../../../lib/chat/conversationExperience/types'

interface Props {
  actions: ConversationSuggestedAction[]
  onAction: (commandHint: string) => void
  disabled?: boolean
}

const FALLBACK_ACTIONS: ConversationSuggestedAction[] = [
  { id: 'book', label: 'Book Now', commandHint: 'Book now' },
  { id: 'pay', label: 'Pay Now', commandHint: 'Pay now' },
  { id: 'refund', label: 'View Refund', commandHint: 'View refund' },
  { id: 'change', label: 'Change Flight', commandHint: 'Change flight' },
  { id: 'upgrade', label: 'Upgrade Hotel', commandHint: 'Upgrade hotel' },
  { id: 'points', label: 'Use Rahhal Points', commandHint: 'Use Rahhal points' },
  { id: 'docs', label: 'View Documents', commandHint: 'Download my ticket' },
  { id: 'track', label: 'Track Trip', commandHint: 'My trip' },
]

function SmartActionsBarImpl({ actions, onAction, disabled }: Props) {
  const rows = actions.length ? actions : FALLBACK_ACTIONS
  return (
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Smart actions">
      {rows.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={disabled}
          onClick={() => onAction(action.commandHint)}
          className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-[11px] font-semibold text-primary-800 transition-colors hover:bg-primary-100 disabled:opacity-40 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

export default memo(SmartActionsBarImpl)
