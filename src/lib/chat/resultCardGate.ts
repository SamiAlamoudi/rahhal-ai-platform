/**
 * Conversation-first card gate — never dump flights/hotels before understanding.
 */

import type { ChatMessage } from './chatTypes'
import { extractConversationUiMeta } from './conversationExperienceUi'

/** True when the traveler has been understood enough to show recommendation cards. */
export function shouldShowTravelerResultCards(message: ChatMessage): boolean {
  if (message.role !== 'assistant') return false
  const meta = message.providerMeta ?? {}

  if (meta.tripPlan || meta.itinerary) return true

  const structured = extractConversationUiMeta(meta).structured
  if (
    structured
    && (
      (structured.flights?.length ?? 0) > 0
      || (structured.hotels?.length ?? 0) > 0
      || (structured.dailyItinerary?.length ?? 0) > 0
    )
  ) {
    return true
  }

  const phase = typeof meta.memory === 'object' && meta.memory && 'phase' in meta.memory
    ? String((meta.memory as { phase?: string }).phase ?? '')
    : ''
  if (phase === 'planned' || phase === 'booked' || phase === 'editing') return true

  // Concierge clarifying / collecting — text only, no inventory dump.
  if (meta.concierge && !meta.tripPlan) return false

  return false
}
