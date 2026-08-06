/**
 * Bilamo Intelligence Layer — contracts.
 * Senior luxury travel consultant, not a chatbot questionnaire.
 */

import type { AgentLocale, AgentMemory, TripRequirements } from '../../agent/types'

export const BILAMO_INTELLIGENCE_VERSION = '1.0.0'

export type BilamoPhase =
  | 'greeting'
  | 'collecting'
  | 'searching'
  | 'recommending'
  | 'refining'

/** Hard slots that may block a first search. Budget is never hard. */
export type BilamoHardSlot = 'destination' | 'dates' | 'travelers'

export interface BilamoConsultantMemory {
  locale: AgentLocale
  phase: BilamoPhase
  /** Round-tripped agent memory (never ask twice). */
  agent: AgentMemory
  /** Fields already asked this session (never re-ask). */
  askedSlots: BilamoHardSlot[]
  /** Preferences remembered across turns. */
  preferences: {
    origin: string | null
    preferredAirline: string | null
    seatClass: string | null
    hotelPreference: string | null
    budgetRange: { amount: number; currency: string } | null
    partyStyle: 'solo' | 'couple' | 'family' | 'friends' | 'business' | null
  }
}

export interface BilamoFlightOption {
  id: string
  airline: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  duration: string
  stopsLabel: string
  price: number
  currency: string
  reason: string
  score: number
}

export interface BilamoHotelOption {
  id: string
  name: string
  area: string
  rating: number
  nightsLabel: string
  price: number
  currency: string
  reason: string
  score: number
}

export interface BilamoContextIntel {
  weather: string | null
  visa: string | null
  currency: string | null
  timeDifference: string | null
  transfer: string | null
}

export interface BilamoSearchBundle {
  flights: BilamoFlightOption[]
  hotels: BilamoHotelOption[]
  context: BilamoContextIntel
  timeline: Array<{
    id: string
    time: string
    title: string
    detail?: string
    kind?: 'flight' | 'hotel' | 'activity' | 'transfer' | 'note'
  }>
}

export interface BilamoTurnResult {
  version: typeof BILAMO_INTELLIGENCE_VERSION
  phase: BilamoPhase
  /** Screen text (streaming). */
  displayText: string
  /** Short spoken consultant line. */
  spokenText: string
  memory: BilamoConsultantMemory
  /** Null while still collecting. */
  search: BilamoSearchBundle | null
  /** Single minimum follow-up slot, if any. */
  askedSlot: BilamoHardSlot | null
  requirements: TripRequirements
}

export interface BilamoTurnInput {
  conversationId: string
  userText: string
  /** Prior messages including the just-appended user turn. */
  messages: Array<{ role: string; content: string; providerMeta?: Record<string, unknown> }>
  priorMemory?: BilamoConsultantMemory | null
  signal?: AbortSignal
  onDelta?: (partial: { displayText: string; spokenText: string }) => void
}
