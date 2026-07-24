import { isJourneyTimelineEnabled } from '../journeyTimelineRegistry'
import type {
  JourneyEventCard,
  JourneyLayout,
  JourneyTimelineLocale,
  JourneyTimelineTheme,
  JourneyTimelineUiState,
} from '../types'
import { JOURNEY_STEPS, JOURNEY_TIMELINE_ISOLATION } from '../types'

export function createDemoJourneyEvents(
  locale: JourneyTimelineLocale = 'ar',
): JourneyEventCard[] {
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar)
  return [
    {
      id: 'e1',
      step: 'departure',
      kind: 'transportation',
      title: t('المغادرة من المنزل', 'Departure from home'),
      subtitle: 'Riyadh',
      timeLabel: '06:00',
      status: 'completed',
      dayIndex: 0,
    },
    {
      id: 'e2',
      step: 'airport',
      kind: 'document',
      title: t('الوصول للمطار', 'Airport arrival'),
      subtitle: 'RUH T1',
      timeLabel: '07:00',
      status: 'completed',
      dayIndex: 0,
    },
    {
      id: 'e3',
      step: 'check_in',
      kind: 'flight',
      title: t('تسجيل الوصول', 'Check-in'),
      subtitle: 'SV123',
      timeLabel: '07:20',
      status: 'completed',
      dayIndex: 0,
    },
    {
      id: 'e4',
      step: 'security',
      kind: 'document',
      title: t('الأمن والجوازات', 'Security & passport'),
      subtitle: t('مكتمل', 'Done'),
      timeLabel: '07:45',
      status: 'completed',
      dayIndex: 0,
    },
    {
      id: 'e5',
      step: 'boarding',
      kind: 'flight',
      title: t('الصعود للطائرة', 'Boarding'),
      subtitle: 'Gate B12',
      timeLabel: '08:10',
      status: 'current',
      dayIndex: 0,
    },
    {
      id: 'e6',
      step: 'flight',
      kind: 'flight',
      title: 'RUH → CDG',
      subtitle: 'SV123',
      timeLabel: '08:40',
      status: 'upcoming',
      dayIndex: 0,
    },
    {
      id: 'e7',
      step: 'arrival',
      kind: 'flight',
      title: t('الوصول باريس', 'Arrive Paris'),
      subtitle: 'CDG',
      timeLabel: '14:10',
      status: 'upcoming',
      dayIndex: 0,
    },
    {
      id: 'e8',
      step: 'transportation',
      kind: 'transportation',
      title: t('نقل للفندق', 'Transfer to hotel'),
      subtitle: t('سيارة خاصة', 'Private car'),
      timeLabel: '15:00',
      status: 'delayed',
      dayIndex: 0,
    },
    {
      id: 'e9',
      step: 'hotel',
      kind: 'hotel',
      title: 'Le Meurice',
      subtitle: t('تسجيل الوصول', 'Check-in'),
      timeLabel: '16:00',
      status: 'upcoming',
      dayIndex: 0,
    },
    {
      id: 'e10',
      step: 'meetings',
      kind: 'meeting',
      title: t('اجتماع تنفيذي', 'Executive meeting'),
      subtitle: 'La Défense',
      timeLabel: '10:00',
      status: 'upcoming',
      dayIndex: 1,
    },
    {
      id: 'e11',
      step: 'lunch',
      kind: 'restaurant',
      title: t('غداء عمل', 'Business lunch'),
      subtitle: t('موصى به', 'Recommended'),
      timeLabel: '13:00',
      status: 'recommended',
      dayIndex: 1,
    },
    {
      id: 'e12',
      step: 'dinner',
      kind: 'restaurant',
      title: t('عشاء', 'Dinner'),
      subtitle: 'Seine',
      timeLabel: '20:00',
      status: 'upcoming',
      dayIndex: 1,
    },
    {
      id: 'e13',
      step: 'activities',
      kind: 'activity',
      title: t('زيارة المتحف', 'Museum visit'),
      subtitle: 'Louvre',
      timeLabel: '15:00',
      status: 'upcoming',
      dayIndex: 2,
    },
    {
      id: 'e14',
      step: 'return',
      kind: 'flight',
      title: t('العودة', 'Return'),
      subtitle: 'CDG → RUH',
      timeLabel: '11:00',
      status: 'upcoming',
      dayIndex: 5,
    },
    {
      id: 'e15',
      step: 'hotel',
      kind: 'visa',
      title: t('التأشيرة', 'Visa'),
      subtitle: t('واجهة فقط', 'Placeholder'),
      timeLabel: '—',
      status: 'completed',
      placeholder: true,
      dayIndex: 0,
    },
    {
      id: 'e16',
      step: 'hotel',
      kind: 'insurance',
      title: t('التأمين', 'Insurance'),
      subtitle: t('واجهة فقط', 'Placeholder'),
      timeLabel: '—',
      status: 'completed',
      placeholder: true,
      dayIndex: 0,
    },
    {
      id: 'e17',
      step: 'arrival',
      kind: 'weather',
      title: t('الطقس', 'Weather'),
      subtitle: t('واجهة فقط', 'Placeholder'),
      timeLabel: '—',
      status: 'upcoming',
      placeholder: true,
      dayIndex: 0,
    },
    {
      id: 'e18',
      step: 'arrival',
      kind: 'currency',
      title: t('العملة', 'Currency'),
      subtitle: t('واجهة فقط', 'Placeholder'),
      timeLabel: '—',
      status: 'upcoming',
      placeholder: true,
      dayIndex: 0,
    },
    {
      id: 'e19',
      step: 'transportation',
      kind: 'maps',
      title: t('الخرائط', 'Maps'),
      subtitle: t('واجهة فقط', 'Placeholder'),
      timeLabel: '—',
      status: 'upcoming',
      placeholder: true,
      dayIndex: 0,
    },
  ]
}

export function createInitialJourneyTimelineState(options?: {
  locale?: JourneyTimelineLocale
  theme?: JourneyTimelineTheme
  enabled?: boolean
  layout?: JourneyLayout
}): JourneyTimelineUiState {
  const locale = options?.locale ?? 'ar'
  return {
    locale,
    theme: options?.theme ?? 'light',
    layout: options?.layout ?? 'vertical',
    events: createDemoJourneyEvents(locale),
    progress: {
      percent: 36,
      currentStep: 'boarding',
      remainingTimeLabel: locale === 'en' ? '5d 8h' : '٥ أيام ٨ س',
      completionLabel: locale === 'en' ? '36% complete' : '٣٦٪ مكتمل',
    },
    featureEnabled: isJourneyTimelineEnabled({ enabled: options?.enabled }),
  }
}

export function eventsForLayout(
  events: JourneyEventCard[],
  layout: JourneyLayout,
): JourneyEventCard[] {
  if (layout === 'daily') return events.filter((e) => e.dayIndex === 0)
  if (layout === 'weekly') return events.filter((e) => e.dayIndex <= 6)
  if (layout === 'compact') {
    return events.filter((e) => !e.placeholder && e.status !== 'cancelled')
  }
  return events
}

export function stepOrderIndex(step: JourneyEventCard['step']): number {
  return JOURNEY_STEPS.indexOf(step)
}

export function assertJourneyTimelineIsolation(): typeof JOURNEY_TIMELINE_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...JOURNEY_TIMELINE_ISOLATION,
    presentationOnly: true,
  }
}
