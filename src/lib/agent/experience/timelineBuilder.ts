/**
 * Phase 3 Stage 5 — Lightweight timeline presentation (no itinerary mutation).
 */

import type { ExperienceLocale, ExperienceTimelineItem } from './types'
import type { ExperienceSourceFacts } from './tripSummary'

let timelineSeq = 0

export function buildExperienceTimeline(
  facts: ExperienceSourceFacts,
): ExperienceTimelineItem[] {
  const ar = facts.locale === 'ar'
  const days = facts.durationDays
  const items: ExperienceTimelineItem[] = []

  timelineSeq += 1
  items.push({
    id: `tl-arrive-${timelineSeq}`,
    day: 1,
    label: ar ? 'الوصول' : 'Arrival',
    detail: facts.destination
      ? ar
        ? `الوصول إلى ${facts.destination}`
        : `Arrive in ${facts.destination}`
      : ar
        ? 'يوم الوصول'
        : 'Arrival day',
    order: 1,
  })

  if (days != null && days >= 3) {
    timelineSeq += 1
    items.push({
      id: `tl-mid-${timelineSeq}`,
      day: Math.max(2, Math.floor(days / 2)),
      label: ar ? 'منتصف الرحلة' : 'Mid-trip',
      detail: ar
        ? 'أنشطة واستكشاف (عرض فقط — بدون تعديل البرنامج)'
        : 'Explore & activities (presentation only — itinerary unchanged)',
      order: 2,
    })
  }

  if (days != null) {
    timelineSeq += 1
    items.push({
      id: `tl-depart-${timelineSeq}`,
      day: days,
      label: ar ? 'المغادرة' : 'Departure',
      detail: ar ? 'يوم المغادرة' : 'Departure day',
      order: 3,
    })
  } else {
    timelineSeq += 1
    items.push({
      id: `tl-open-${timelineSeq}`,
      day: null,
      label: ar ? 'الجدول' : 'Schedule',
      detail: ar
        ? 'أضف عدد الأيام لبناء خط زمني أوضح'
        : 'Add trip length for a clearer timeline',
      order: 2,
    })
  }

  return items
}

export function timelineLocaleLabel(locale: ExperienceLocale): string {
  return locale === 'ar' ? 'الخط الزمني' : 'Timeline'
}

export const TimelineBuilder = {
  build: buildExperienceTimeline,
  label: timelineLocaleLabel,
}
