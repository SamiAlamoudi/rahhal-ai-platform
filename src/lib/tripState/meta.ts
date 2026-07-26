/**
 * Persist / restore TripState on agent provider_meta (additive).
 */

import { emptyTripState, type TripConversationStage, type TripMissingField, type TripState } from './types'

const STAGES = new Set<TripConversationStage>([
  'DISCOVERY',
  'CLARIFICATION',
  'PLANNING',
  'RECOMMENDATIONS',
  'ITINERARY',
  'BOOKING_READY',
])

export function isTripState(value: unknown): value is TripState {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.conversationStage === 'string'
    && STAGES.has(row.conversationStage as TripConversationStage)
    && typeof row.completionPercentage === 'number'
    && Array.isArray(row.missingFields)
}

export function tripStateFromMeta(
  meta: Record<string, unknown> | null | undefined,
): TripState | null {
  if (!meta || typeof meta !== 'object') return null
  const raw = meta.tripState
  if (!isTripState(raw)) return null
  return normalizeTripState(raw)
}

export function rebuildTripStateFromMessages(
  messages: Array<{ role: string; providerMeta?: Record<string, unknown> | null }>,
): TripState | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue
    const state = tripStateFromMeta(msg.providerMeta ?? null)
    if (state) return state
  }
  return null
}

export function toMetaTripState(state: TripState): TripState {
  return normalizeTripState(state)
}

function normalizeTripState(raw: TripState): TripState {
  const base = emptyTripState()
  return {
    ...base,
    ...raw,
    travelDates: {
      start: raw.travelDates?.start ?? null,
      end: raw.travelDates?.end ?? null,
    },
    activities: [...(raw.activities ?? [])],
    foodPreferences: [...(raw.foodPreferences ?? [])],
    missingFields: [...(raw.missingFields ?? [])] as TripMissingField[],
    conversationStage: STAGES.has(raw.conversationStage)
      ? raw.conversationStage
      : 'DISCOVERY',
  }
}
