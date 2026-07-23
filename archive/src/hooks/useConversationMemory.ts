import { useMemo } from 'react'
import type { BrainMemorySlot, ConversationMemory } from '../lib/brain'

export type UseConversationMemoryOptions = {
  memory: ConversationMemory
}

export type UseConversationMemoryReturn = {
  memory: ConversationMemory
  destination: string | null
  budgetLabel: string
  travelersLabel: string
  answeredFields: BrainMemorySlot[]
  askedFields: BrainMemorySlot[]
  filledCount: number
}

/**
 * Derived view over ConversationMemory.
 */
export function useConversationMemory(
  options: UseConversationMemoryOptions,
): UseConversationMemoryReturn {
  const { memory } = options

  return useMemo(() => {
    const budgetLabel = memory.budget.flexible
      ? 'flexible'
      : memory.budget.amount != null
        ? `${memory.budget.amount} ${memory.budget.currency ?? memory.currency ?? ''}`.trim()
        : '—'

    const travelersLabel =
      memory.travelers.count != null ? String(memory.travelers.count) : '—'

    return {
      memory,
      destination: memory.destination,
      budgetLabel,
      travelersLabel,
      answeredFields: memory.answeredFields,
      askedFields: memory.askedFields,
      filledCount: memory.answeredFields.length,
    }
  }, [memory])
}
