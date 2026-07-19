/**
 * Sprint 37 — Conversation helpers for travel disruption recovery.
 * Invokes TravelDisruptionEngine from natural language — no booking forms.
 */

import { isTravelDisruptionEngineEnabled } from '../DisruptionFeatureFlags'
import type { TravelDisruptionEngine } from '../TravelDisruptionEngine'
import { isDisruptionHandlingResult } from '../TravelDisruptionEngine'
import type { DisruptionContext, DisruptionEventType } from '../types'

export type DisruptionConversationQueryKind =
  | 'flight_delayed'
  | 'flight_cancelled'
  | 'missed_connection'
  | 'hotel_cancelled'
  | 'gate_changed'
  | 'schedule_changed'
  | 'car_unavailable'
  | 'activity_cancelled'
  | 'airport_closure'
  | 'weather_disruption'
  | 'strike'
  | 'visa_rejection'
  | 'border_restriction'

const KIND_TO_EVENT: Record<DisruptionConversationQueryKind, DisruptionEventType> = {
  flight_delayed: 'flight_delayed',
  flight_cancelled: 'flight_cancelled',
  missed_connection: 'missed_connection',
  hotel_cancelled: 'hotel_unavailable',
  gate_changed: 'gate_changed',
  schedule_changed: 'schedule_changed',
  car_unavailable: 'car_unavailable',
  activity_cancelled: 'activity_cancelled',
  airport_closure: 'airport_closure',
  weather_disruption: 'weather_disruption',
  strike: 'strike',
  visa_rejection: 'visa_rejection',
  border_restriction: 'border_restriction',
}

export function detectDisruptionConversationQuery(
  userText: string,
): DisruptionConversationQueryKind | null {
  const lower = userText.toLowerCase().trim()

  if (/missed (my )?connection|miss(ed)? my connecting/.test(lower) || /فاتتني المواصلة/.test(lower)) {
    return 'missed_connection'
  }
  if (
    /my flight (was |is )?cancelled|flight (was |is )?cancelled|canceled my flight/.test(lower)
    || /ألغيت رحلتي|تم إلغاء رحلتي/.test(lower)
  ) {
    return 'flight_cancelled'
  }
  if (
    /my flight (is |was )?delayed|flight (is |was )?delayed by|delayed by \d+/.test(lower)
    || /تأجلت رحلتي|رحلتي متأخرة/.test(lower)
  ) {
    // Keep policy/hypothetical questions for Sprint 36 refund engine.
    if (/what happens if|refund|policy|will i get/.test(lower)) return null
    return 'flight_delayed'
  }
  if (
    /my hotel (cancelled|canceled)|hotel cancelled my|hotel canceled my|hotel overbook/.test(lower)
    || /ألغى الفندق|الفندق ألغى/.test(lower)
  ) {
    return 'hotel_cancelled'
  }
  if (/gate (was |has )?changed|new gate|gate change/.test(lower)) return 'gate_changed'
  if (/schedule (was |has )?changed|rescheduled/.test(lower)) return 'schedule_changed'
  if (/car (is )?unavailable|rental (was )?cancelled/.test(lower)) return 'car_unavailable'
  if (/activity (was |is )?cancelled|tour cancelled/.test(lower)) return 'activity_cancelled'
  if (/airport (is )?closed|airport closure/.test(lower)) return 'airport_closure'
  if (/weather (disruption|delay|cancel)|storm|fog/.test(lower)) return 'weather_disruption'
  if (/\bstrike\b|industrial action/.test(lower)) return 'strike'
  if (/visa (was )?rejected|visa denial/.test(lower)) return 'visa_rejection'
  if (/border (restriction|closed)|entry ban/.test(lower)) return 'border_restriction'
  return null
}

export function answerDisruptionQuery(input: {
  kind: DisruptionConversationQueryKind
  engine: TravelDisruptionEngine
  context: DisruptionContext
  delayMinutes?: number
  locale?: 'ar' | 'en'
}): string {
  const result = input.engine.handle({
    eventType: KIND_TO_EVENT[input.kind],
    context: input.context,
    delayMinutes: input.delayMinutes,
    autoApplyBestPlan: true,
    locale: input.locale ?? 'en',
    signal: { source: 'conversation', kind: input.kind },
  })

  if (!isDisruptionHandlingResult(result)) {
    return result.message
  }
  return result.explanation
}

export function shouldHandleDisruptionQueries(options?: {
  travelDisruptionEngineEnabled?: boolean
}): boolean {
  return isTravelDisruptionEngineEnabled(options)
}

export function disruptionKindToEventType(
  kind: DisruptionConversationQueryKind,
): DisruptionEventType {
  return KIND_TO_EVENT[kind]
}
