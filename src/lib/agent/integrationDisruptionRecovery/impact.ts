/**
 * Integration Sprint 10 — impact analyzer (timeline / hotel / transfers / meetings / activities / budget).
 */

import type { TripPlan } from '../types'
import type { DetectedLiveDisruption, DisruptionImpact } from './types'

export function analyzeDisruptionImpact(input: {
  disruption: DetectedLiveDisruption
  plan?: TripPlan | null
}): DisruptionImpact {
  const { disruption, plan } = input
  const kind = disruption.kind
  const delay = disruption.delayMinutes

  const timeline = kind !== 'gate_change'
  const hotel = [
    'flight_delay',
    'flight_cancellation',
    'missed_connection',
    'hotel_overbooking',
    'late_check_in',
    'weather_disruption',
  ].includes(kind)
  const transfers = [
    'flight_delay',
    'flight_cancellation',
    'missed_connection',
    'gate_change',
    'weather_disruption',
  ].includes(kind)
  const meetings = delay >= 45 || kind === 'missed_connection' || kind === 'flight_cancellation'
  const activities = kind !== 'gate_change'
  const budget = [
    'flight_cancellation',
    'missed_connection',
    'hotel_overbooking',
    'weather_disruption',
  ].includes(kind) || delay >= 180
  const overnightLikely =
    kind === 'flight_cancellation'
    || kind === 'missed_connection'
    || delay >= 360
    || (kind === 'weather_disruption' && delay >= 240)

  let stress = 35
  if (disruption.risk === 'medium') stress = 55
  if (disruption.risk === 'high') stress = 75
  if (disruption.risk === 'critical') stress = 92
  if (plan?.accommodations[0] && hotel) stress += 4
  if (meetings) stress += 5

  const hit: string[] = []
  if (timeline) hit.push('timeline')
  if (hotel) hit.push('hotel')
  if (transfers) hit.push('transfers')
  if (meetings) hit.push('meetings')
  if (activities) hit.push('activities')
  if (budget) hit.push('budget')

  return {
    timeline,
    hotel,
    transfers,
    meetings,
    activities,
    budget,
    stressScore: Math.min(100, stress),
    overnightLikely,
    summaryEn: `Impact on ${hit.join(', ') || 'limited areas'}${overnightLikely ? ' · overnight likely' : ''}.`,
    summaryAr: `أثر على ${hit.join('، ') || 'نطاق محدود'}${overnightLikely ? ' · مبيت محتمل' : ''}.`,
  }
}
