/**
 * Integration Sprint 7 — Smart notification engine (prepared; no live push).
 */

import type {
  CompanionNotification,
  CompanionNotificationKind,
  CompanionTimelineEvent,
  TripSessionState,
} from './types'

function minutesBefore(iso: string, minutes: number): string {
  const d = new Date(iso)
  d.setUTCMinutes(d.getUTCMinutes() - minutes)
  return d.toISOString()
}

function note(
  kind: CompanionNotificationKind,
  event: CompanionTimelineEvent | null,
  fireAt: string,
  en: { title: string; body: string },
  ar: { title: string; body: string },
): CompanionNotification {
  return {
    id: `notif-${kind}-${event?.id ?? 'general'}`,
    kind,
    titleEn: en.title,
    titleAr: ar.title,
    bodyEn: en.body,
    bodyAr: ar.body,
    fireAt,
    relatedEventId: event?.id ?? null,
    channelReady: false,
  }
}

export function buildCompanionNotifications(input: {
  events: CompanionTimelineEvent[]
  sessionState: TripSessionState
  now?: Date
}): CompanionNotification[] {
  const now = input.now ?? new Date()
  const out: CompanionNotification[] = []
  const flights = input.events.filter((e) => e.kind === 'flight')
  const hotel = input.events.find((e) => e.kind === 'hotel_check_in')
  const meetings = input.events.filter((e) => e.kind === 'meeting')
  const restaurants = input.events.filter((e) => e.kind === 'restaurant')

  for (const flight of flights) {
    out.push(note(
      'upcoming_flight',
      flight,
      minutesBefore(flight.startAt, 24 * 60),
      {
        title: 'Upcoming flight',
        body: `${flight.titleEn} is tomorrow — confirm documents and gate later.`,
      },
      {
        title: 'رحلة قادمة',
        body: `${flight.titleAr} غداً — جهّز الوثائق وتابع البوابة لاحقاً.`,
      },
    ))
    out.push(note(
      'airport_departure',
      flight,
      minutesBefore(flight.startAt, 180),
      {
        title: 'Leave for the airport',
        body: `Plan to leave in about 3 hours for ${flight.titleEn}.`,
      },
      {
        title: 'المغادرة إلى المطار',
        body: `خطّط للمغادرة خلال نحو 3 ساعات لـ ${flight.titleAr}.`,
      },
    ))
    out.push(note(
      'passport_reminder',
      flight,
      minutesBefore(flight.startAt, 12 * 60),
      {
        title: 'Passport check',
        body: 'Confirm passport validity and any visas before travel day.',
      },
      {
        title: 'تذكير الجواز',
        body: 'تأكد من صلاحية الجواز والتأشيرات قبل يوم السفر.',
      },
    ))
    out.push(note(
      'gate_reminder',
      flight,
      minutesBefore(flight.startAt, 75),
      {
        title: 'Gate reminder',
        body: 'Check the departure board for your gate assignment.',
      },
      {
        title: 'تذكير البوابة',
        body: 'راجع لوحة المغادرة لمعرفة رقم البوابة.',
      },
    ))
    out.push(note(
      'boarding_reminder',
      flight,
      minutesBefore(flight.startAt, 45),
      {
        title: 'Boarding soon',
        body: 'Boarding typically starts ~45 minutes before departure.',
      },
      {
        title: 'الصعود قريباً',
        body: 'يبدأ الصعود عادة قبل الإقلاع بنحو 45 دقيقة.',
      },
    ))
  }

  if (hotel) {
    out.push(note(
      'hotel_check_in',
      hotel,
      minutesBefore(hotel.startAt, 60),
      {
        title: 'Hotel check-in',
        body: `${hotel.titleEn} — have your booking reference ready.`,
      },
      {
        title: 'تسجيل الوصول للفندق',
        body: `${hotel.titleAr} — جهّز رقم الحجز.`,
      },
    ))
  }

  for (const meeting of meetings) {
    out.push(note(
      'meeting_reminder',
      meeting,
      minutesBefore(meeting.startAt, 45),
      {
        title: 'Meeting reminder',
        body: `${meeting.titleEn} starts soon.`,
      },
      {
        title: 'تذكير اجتماع',
        body: `${meeting.titleAr} يبدأ قريباً.`,
      },
    ))
  }

  for (const restaurant of restaurants) {
    out.push(note(
      'restaurant_reservation',
      restaurant,
      minutesBefore(restaurant.startAt, 90),
      {
        title: 'Restaurant reservation',
        body: `${restaurant.titleEn} — leave a buffer for traffic.`,
      },
      {
        title: 'حجز مطعم',
        body: `${restaurant.titleAr} — اترك هامشاً للزحام.`,
      },
    ))
  }

  // Only keep notifications still relevant (fireAt in the future or within recent window).
  return out
    .filter((n) => new Date(n.fireAt).getTime() >= now.getTime() - 60 * 60000)
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt))
    .slice(0, 12)
}
