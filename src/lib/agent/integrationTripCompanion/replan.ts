/**
 * Integration Sprint 7 — Dynamic replanning when disruptions occur.
 */

import type { CompanionDisruption, CompanionTimelineEvent } from './types'

function shiftIso(iso: string, minutes: number): string {
  const d = new Date(iso)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return d.toISOString()
}

export function detectCompanionDisruption(userText: string | null | undefined): CompanionDisruption | null {
  const t = (userText ?? '').trim()
  if (!t) return null
  const lower = t.toLowerCase()

  if (/flight\s+delay|delayed\s+flight|تأخير\s*الرحلة|الرحلة\s*تأخر/.test(lower) || /تأخرت?\s*الرحلة/.test(t)) {
    const mins = Number(t.match(/(\d+)\s*(min|minutes|دقيقة|دقائق)/i)?.[1] ?? 60)
    return {
      kind: 'flight_delayed',
      detailEn: `Flight delayed by ~${mins} minutes.`,
      detailAr: `تأخرت الرحلة نحو ${mins} دقيقة.`,
      delayMinutes: mins,
      eventId: 'flight-outbound',
    }
  }

  if (/hotel\s+(unavailable|cancelled|full)|الفندق\s*(غير|مش)\s*متاح|إلغاء\s*الفندق/.test(lower)) {
    return {
      kind: 'hotel_unavailable',
      detailEn: 'Hotel unavailable — shifting check-in and later activities.',
      detailAr: 'الفندق غير متاح — سأعدّل تسجيل الوصول والأنشطة التالية.',
      delayMinutes: 90,
      eventId: 'hotel-check-in',
    }
  }

  if (/meeting\s+(changed|moved|reschedule)|تغي[رّ]\s*الاجتماع|تأجيل\s*الاجتماع/.test(lower)) {
    const mins = Number(t.match(/(\d+)\s*(min|minutes|دقيقة|دقائق)/i)?.[1] ?? 45)
    return {
      kind: 'meeting_changed',
      detailEn: `Meeting moved by ~${mins} minutes.`,
      detailAr: `تم تحريك الاجتماع نحو ${mins} دقيقة.`,
      delayMinutes: mins,
    }
  }

  if (/traffic|زحمة|ازدحام/.test(lower)) {
    const mins = Number(t.match(/(\d+)\s*(min|minutes|دقيقة|دقائق)/i)?.[1] ?? 30)
    return {
      kind: 'traffic_delay',
      detailEn: `Traffic delay ~${mins} minutes.`,
      detailAr: `تأخير مروري نحو ${mins} دقيقة.`,
      delayMinutes: mins,
    }
  }

  if (/skip(ped)?\s+(the\s+)?activity|تخطيت|سأتخطى|skip\s+activity/.test(lower)) {
    return {
      kind: 'activity_skipped',
      detailEn: 'Activity skipped — rebuilding the rest of today.',
      detailAr: 'تم تخطي نشاط — سأعيد ترتيب بقية اليوم.',
      delayMinutes: 0,
    }
  }

  return null
}

export function replanTimeline(
  events: CompanionTimelineEvent[],
  disruption: CompanionDisruption,
): { events: CompanionTimelineEvent[]; skippedEventIds: string[] } {
  const delay = Math.max(0, disruption.delayMinutes ?? 0)
  const skippedEventIds: string[] = []

  if (disruption.kind === 'activity_skipped') {
    const target = events.find((e) => e.status === 'current' || e.status === 'upcoming' || e.status === 'late')
    if (target) skippedEventIds.push(target.id)
    const next = events.map((e) => {
      if (skippedEventIds.includes(e.id)) {
        return { ...e, status: 'skipped' as const, notesEn: 'Skipped by traveler', notesAr: 'تخطاه المسافر' }
      }
      if (target && e.startAt > target.startAt) {
        // Pull following events slightly earlier to recover time
        return {
          ...e,
          startAt: shiftIso(e.startAt, -20),
          endAt: e.endAt ? shiftIso(e.endAt, -20) : null,
          status: e.status === 'missed' ? e.status : 'rescheduled' as const,
          notesEn: 'Pulled forward after skip',
          notesAr: 'قُدّم بعد التخطي',
        }
      }
      return e
    })
    return { events: next.sort((a, b) => a.startAt.localeCompare(b.startAt)), skippedEventIds }
  }

  if (disruption.kind === 'hotel_unavailable') {
    const next = events.map((e) => {
      if (e.kind === 'hotel_check_in' || e.id === disruption.eventId) {
        return {
          ...e,
          titleEn: `${e.titleEn} (alternative hotel pending)`,
          titleAr: `${e.titleAr} (فندق بديل قيد الترتيب)`,
          startAt: shiftIso(e.startAt, delay || 90),
          status: 'rescheduled' as const,
        }
      }
      if (e.kind === 'activity' || e.kind === 'restaurant') {
        return {
          ...e,
          startAt: shiftIso(e.startAt, delay || 90),
          endAt: e.endAt ? shiftIso(e.endAt, delay || 90) : null,
          status: 'rescheduled' as const,
        }
      }
      return e
    })
    return { events: next.sort((a, b) => a.startAt.localeCompare(b.startAt)), skippedEventIds }
  }

  // flight_delayed / meeting_changed / traffic_delay — shift cascade from anchor
  const anchorId = disruption.eventId
    ?? (disruption.kind === 'flight_delayed'
      ? events.find((e) => e.kind === 'flight')?.id
      : disruption.kind === 'meeting_changed'
        ? events.find((e) => e.kind === 'meeting')?.id
        : events.find((e) => e.status === 'current' || e.status === 'upcoming')?.id)

  const anchor = events.find((e) => e.id === anchorId) ?? events[0]
  const next = events.map((e) => {
    if (!anchor) return e
    if (e.id === anchor.id || e.startAt >= anchor.startAt) {
      return {
        ...e,
        startAt: shiftIso(e.startAt, delay),
        endAt: e.endAt ? shiftIso(e.endAt, delay) : null,
        status: 'rescheduled' as const,
        notesEn: disruption.detailEn,
        notesAr: disruption.detailAr,
      }
    }
    return e
  })

  return { events: next.sort((a, b) => a.startAt.localeCompare(b.startAt)), skippedEventIds }
}
