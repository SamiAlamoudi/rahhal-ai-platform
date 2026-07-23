import { useMemo } from 'react'
import type {
  ConversationContext,
  TravelGoals,
  TravelIntent,
  TripPreferences,
} from '../lib/brain'

export type UseTravelContextOptions = {
  context: ConversationContext
}

export type UseTravelContextReturn = {
  context: ConversationContext
  intent: TravelIntent | null
  goals: TravelGoals
  preferences: TripPreferences
  missingFields: ConversationContext['missingFields']
  locale: ConversationContext['locale']
  turnCount: number
}

/**
 * Derived travel context from ConversationContext.
 */
export function useTravelContext(
  options: UseTravelContextOptions,
): UseTravelContextReturn {
  const { context } = options
  return useMemo(
    () => ({
      context,
      intent: context.lastIntent,
      goals: context.goals,
      preferences: context.preferences,
      missingFields: context.missingFields,
      locale: context.locale,
      turnCount: context.history.turns.length,
    }),
    [context],
  )
}
