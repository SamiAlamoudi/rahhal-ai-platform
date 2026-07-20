/**
 * Sprint 37 — DisruptionDetector
 * Maps signals / user text / flight status into DetectedDisruption.
 */

import type { DetectedDisruption, DisruptionContext, DisruptionEventType, DisruptionSeverity } from './types'

const SEVERITY: Record<DisruptionEventType, DisruptionSeverity> = {
  flight_delayed: 'medium',
  flight_cancelled: 'high',
  gate_changed: 'low',
  schedule_changed: 'medium',
  missed_connection: 'high',
  hotel_overbooking: 'high',
  hotel_unavailable: 'high',
  car_unavailable: 'medium',
  activity_cancelled: 'low',
  airport_closure: 'critical',
  weather_disruption: 'high',
  strike: 'critical',
  visa_rejection: 'critical',
  border_restriction: 'critical',
}

const AFFECTED: Record<
  DisruptionEventType,
  Array<'flight' | 'hotel' | 'car' | 'activity' | 'transport' | 'visa'>
> = {
  flight_delayed: ['flight', 'transport', 'activity'],
  flight_cancelled: ['flight', 'hotel', 'transport', 'activity'],
  gate_changed: ['flight'],
  schedule_changed: ['flight', 'transport', 'activity'],
  missed_connection: ['flight', 'transport', 'hotel'],
  hotel_overbooking: ['hotel'],
  hotel_unavailable: ['hotel'],
  car_unavailable: ['car', 'transport'],
  activity_cancelled: ['activity'],
  airport_closure: ['flight', 'transport', 'hotel', 'activity'],
  weather_disruption: ['flight', 'activity', 'transport'],
  strike: ['flight', 'transport', 'hotel'],
  visa_rejection: ['visa', 'flight', 'hotel'],
  border_restriction: ['visa', 'flight'],
}

export class DisruptionDetector {
  detect(input: {
    eventType: DisruptionEventType
    context: DisruptionContext
    signal?: Record<string, unknown>
    delayMinutes?: number
  }): DetectedDisruption {
    const delayMinutes =
      input.delayMinutes
      ?? input.context.currentDelayMinutes
      ?? num(input.signal?.delayMinutes, defaultDelay(input.eventType))

    let severity = SEVERITY[input.eventType]
    if (input.eventType === 'flight_delayed' && delayMinutes >= 180) severity = 'high'
    if (input.eventType === 'flight_delayed' && delayMinutes >= 360) severity = 'critical'

    return {
      disruptionId: `dis_${Math.random().toString(36).slice(2, 10)}`,
      eventType: input.eventType,
      detectedAt: new Date().toISOString(),
      severity,
      summary: summarize(input.eventType, delayMinutes, input.context),
      delayMinutes,
      affectedServices: [...AFFECTED[input.eventType]],
      rawSignal: { ...input.signal, delayMinutes },
    }
  }

  detectFromUserText(userText: string): DisruptionEventType | null {
    const lower = userText.toLowerCase().trim()
    if (/missed (my )?connection|miss(ed)? my connecting/.test(lower)) return 'missed_connection'
    if (/flight (was |is )?cancelled|canceled my flight|flight cancel/.test(lower)) {
      return 'flight_cancelled'
    }
    if (/flight (is |was )?delayed|my flight.*delay|delayed by/.test(lower)) {
      return 'flight_delayed'
    }
    if (/gate (was |has )?changed|new gate|gate change/.test(lower)) return 'gate_changed'
    if (/schedule (was |has )?changed|rescheduled/.test(lower)) return 'schedule_changed'
    if (/hotel (cancelled|canceled|overbook)/.test(lower) || /overbooked/.test(lower)) {
      return /overbook/.test(lower) ? 'hotel_overbooking' : 'hotel_unavailable'
    }
    if (/hotel.*unavailable|no room at/.test(lower)) return 'hotel_unavailable'
    if (/car (is )?unavailable|rental (was )?cancelled/.test(lower)) return 'car_unavailable'
    if (/activity (was |is )?cancelled|tour cancelled/.test(lower)) return 'activity_cancelled'
    if (/airport (is )?closed|airport closure/.test(lower)) return 'airport_closure'
    if (/weather (disruption|delay|cancel)|storm|fog/.test(lower)) return 'weather_disruption'
    if (/\bstrike\b|industrial action/.test(lower)) return 'strike'
    if (/visa (was )?rejected|visa denial/.test(lower)) return 'visa_rejection'
    if (/border (restriction|closed)|entry ban/.test(lower)) return 'border_restriction'
    return null
  }
}

export function createDisruptionDetector(): DisruptionDetector {
  return new DisruptionDetector()
}

function defaultDelay(event: DisruptionEventType): number {
  switch (event) {
    case 'flight_delayed':
      return 180
    case 'missed_connection':
      return 240
    case 'schedule_changed':
      return 120
    case 'gate_changed':
      return 0
    case 'flight_cancelled':
    case 'airport_closure':
    case 'strike':
      return 720
    default:
      return 60
  }
}

function summarize(
  event: DisruptionEventType,
  delayMinutes: number,
  ctx: DisruptionContext,
): string {
  const hours = Math.round((delayMinutes / 60) * 10) / 10
  switch (event) {
    case 'flight_delayed':
      return `Flight delayed by ${hours} hour(s)`
    case 'flight_cancelled':
      return `Flight to ${ctx.destination} was cancelled`
    case 'gate_changed':
      return `Gate changed${ctx.gate ? ` to ${ctx.gate}` : ''}`
    case 'missed_connection':
      return 'Missed connection — onward journey at risk'
    case 'hotel_overbooking':
    case 'hotel_unavailable':
      return `Hotel unavailable in ${ctx.destination}`
    case 'car_unavailable':
      return 'Rental car unavailable'
    case 'activity_cancelled':
      return 'Activity cancelled by provider'
    case 'airport_closure':
      return 'Airport closure affecting travel'
    case 'weather_disruption':
      return 'Weather disruption affecting itinerary'
    case 'strike':
      return 'Strike disrupting transport services'
    case 'visa_rejection':
      return 'Visa rejection blocking travel'
    case 'border_restriction':
      return 'Border restriction affecting entry'
    default:
      return `Schedule changed for trip to ${ctx.destination}`
  }
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
