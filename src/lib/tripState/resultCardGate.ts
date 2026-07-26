/**
 * Recommendation cards only after TripState planning is complete.
 */

import type { ChatMessage } from '../chat/chatTypes'
import { tripStateFromMeta } from './meta'
import { cardsAllowedForStage } from './stages'
import type { TripConversationStage } from './types'

export function shouldShowTravelerResultCards(message: ChatMessage): boolean {
  if (message.role !== 'assistant') return false
  const meta = message.providerMeta ?? {}

  const tripState = tripStateFromMeta(meta)
  if (tripState) return tripState.cardsAllowed

  // Fallback when older messages lack tripState: require a real trip plan.
  if (meta.tripPlan || meta.itinerary) return true
  const phase = typeof meta.memory === 'object' && meta.memory && 'phase' in meta.memory
    ? String((meta.memory as { phase?: string }).phase ?? '')
    : ''
  if (phase === 'planned' || phase === 'editing') return true

  // Concierge collecting / clarifying without a plan — no inventory dump.
  if (meta.concierge && !meta.tripPlan) return false

  return false
}

export function cardsAllowedForTripStage(stage: TripConversationStage): boolean {
  return cardsAllowedForStage(stage)
}
