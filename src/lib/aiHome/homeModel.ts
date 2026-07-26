/**
 * Assemble AI Home dashboard model from existing booking/order projections.
 */

import type { BookingRecord } from '../booking/bookingRecord'
import { getBookingOrchestrator } from '../booking/bookingOrchestrator'
import type { ManagedOrder } from '../orderManagement'
import {
  buildContinueBookingModel,
  findContinueBookingCandidate,
} from './continueBooking'
import { buildAiHomeGreeting } from './greeting'
import { listSuggestedPrompts } from './suggestedPrompts'
import { buildTravelCards } from './travelCards'
import type { AiHomeModel, HomeLocale } from './types'
import { buildVoiceAwareChatNavigation } from './voiceEntryHandoff'

export interface BuildAiHomeModelInput {
  locale?: HomeLocale
  displayName?: string | null
  returning?: boolean
  records: BookingRecord[]
  orders: ManagedOrder[]
  now?: Date
  includeContinueSuggestion?: boolean
}

export function buildAiHomeModel(input: BuildAiHomeModelInput): AiHomeModel {
  const upcoming = input.records.filter((r) => r.bucket === 'upcoming')
  const continueRecord = findContinueBookingCandidate(input.records)
  const orch = getBookingOrchestrator()
  const session = continueRecord
    ? orch.getBookingSession(continueRecord.sessionId)
    : null
  const continueBooking = continueRecord
    ? buildContinueBookingModel(continueRecord, session)
    : null

  return {
    greeting: buildAiHomeGreeting({
      displayName: input.displayName,
      returning: input.returning ?? input.records.length > 0,
      now: input.now,
    }),
    suggestions: listSuggestedPrompts({
      includeContinue: input.includeContinueSuggestion ?? Boolean(continueBooking),
      limit: 6,
    }),
    continueBooking,
    travelCards: buildTravelCards({
      upcoming,
      orders: input.orders,
      locale: input.locale ?? 'ar',
    }),
    upcomingCount: upcoming.length,
    recentOrderCount: input.orders.length,
  }
}

export type ConversationEntryState = {
  seedMessage: string
  tripText: string
  initialPrompt: string
  /** When true, ChatPage continues as a real voice session (TTS + listen loop). */
  startVoice?: boolean
  /** Stable id for duplicate-final guards across home → chat. */
  voiceTurnId?: string
}

/** Conversation entry target — Chat (Sprint 9 agent) with durable voice handoff. */
export function conversationEntryPath(
  seedMessage: string,
  options?: { startVoice?: boolean },
): {
  pathname: string
  search: string
  state: ConversationEntryState
} {
  const nav = buildVoiceAwareChatNavigation(seedMessage, {
    startVoice: options?.startVoice === true,
  })
  return {
    pathname: nav.pathname,
    search: nav.search,
    state: nav.state,
  }
}
