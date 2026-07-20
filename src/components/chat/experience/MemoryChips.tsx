import { memo } from 'react'
import type { ConversationMemoryChip } from '../../../lib/chat/conversationExperienceUi'

interface Props {
  chips: ConversationMemoryChip[]
}

function MemoryChipsImpl({ chips }: Props) {
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Remembered travel preferences">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <span className="font-semibold text-slate-500 dark:text-slate-400">{chip.label}:</span>
          <span>{chip.value}</span>
        </span>
      ))}
    </div>
  )
}

export default memo(MemoryChipsImpl)
