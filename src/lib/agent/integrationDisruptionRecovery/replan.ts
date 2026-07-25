/**
 * Integration Sprint 10 — automatic replan of timeline / hotel / transfers / meetings / activities / budget.
 */

import type { TripPlan } from '../types'
import { replanTimeline } from '../integrationTripCompanion/replan'
import { seedEventsFromPlan } from '../integrationTripCompanion/timeline'
import type { CompanionDisruption } from '../integrationTripCompanion/types'
import type { AutoReplanSnapshot, DetectedLiveDisruption, DisruptionImpact } from './types'

function toCompanionDisruption(d: DetectedLiveDisruption): CompanionDisruption {
  if (d.kind === 'flight_delay' || d.kind === 'missed_connection' || d.kind === 'weather_disruption') {
    return {
      kind: 'flight_delayed',
      detailEn: d.summaryEn,
      detailAr: d.summaryAr,
      delayMinutes: d.delayMinutes,
      eventId: 'flight-outbound',
    }
  }
  if (d.kind === 'hotel_overbooking' || d.kind === 'late_check_in') {
    return {
      kind: 'hotel_unavailable',
      detailEn: d.summaryEn,
      detailAr: d.summaryAr,
      delayMinutes: Math.max(60, d.delayMinutes),
      eventId: 'hotel-check-in',
    }
  }
  if (d.kind === 'activity_cancellation') {
    return {
      kind: 'activity_skipped',
      detailEn: d.summaryEn,
      detailAr: d.summaryAr,
      delayMinutes: 0,
    }
  }
  return {
    kind: 'traffic_delay',
    detailEn: d.summaryEn,
    detailAr: d.summaryAr,
    delayMinutes: d.delayMinutes,
  }
}

export function buildAutoReplan(input: {
  disruption: DetectedLiveDisruption
  impact: DisruptionImpact
  plan?: TripPlan | null
  recoveryExtraCost?: number
}): AutoReplanSnapshot {
  const shift = input.disruption.delayMinutes
  const notesEn: string[] = []
  const notesAr: string[] = []

  if (input.plan) {
    const events = seedEventsFromPlan(input.plan)
    const companion = toCompanionDisruption(input.disruption)
    const replanned = replanTimeline(events, companion)
    if (replanned.events.some((e) => e.status === 'rescheduled' || e.status === 'skipped')) {
      notesEn.push('Timeline events rescheduled around the disruption.')
      notesAr.push('أُعيد جدولة أحداث الجدول حول التعطيل.')
    }
  } else {
    notesEn.push('No trip plan loaded — shift guidance is advisory only.')
    notesAr.push('لا توجد خطة رحلة محمّلة — الإرشاد إرشادي فقط.')
  }

  const hotelCheckInAdjusted = input.impact.hotel
  const transfersAdjusted = input.impact.transfers
  const meetingsAdjusted = input.impact.meetings
  const activitiesAdjusted = input.impact.activities
  const budgetDelta = input.recoveryExtraCost ?? 0

  if (hotelCheckInAdjusted) {
    notesEn.push(`Hotel check-in pushed ~${Math.max(60, shift)} minutes / protected for late arrival.`)
    notesAr.push(`تسجيل الفندق أُجّل نحو ${Math.max(60, shift)} دقيقة / حماية وصول متأخر.`)
  }
  if (transfersAdjusted) {
    notesEn.push('Airport transfers recalculated for the new arrival window.')
    notesAr.push('أُعيد حساب التوصيلات للمطار وفق نافذة الوصول الجديدة.')
  }
  if (meetingsAdjusted) {
    notesEn.push('Meetings flagged for reschedule or remote fallback.')
    notesAr.push('الاجتماعات بحاجة لإعادة جدولة أو بديل عن بُعد.')
  }
  if (activitiesAdjusted) {
    notesEn.push('Same-day activities compressed or moved.')
    notesAr.push('أُنجزت ضغط/نقل لأنشطة نفس اليوم.')
  }
  if (budgetDelta > 0) {
    notesEn.push(`Budget delta ~${budgetDelta} for recovery actions.`)
    notesAr.push(`فرق الميزانية نحو ${budgetDelta} لإجراءات الاستعادة.`)
  }

  return {
    timelineShiftedMinutes: shift,
    hotelCheckInAdjusted,
    transfersAdjusted,
    meetingsAdjusted,
    activitiesAdjusted,
    budgetDelta,
    notesEn,
    notesAr,
  }
}
