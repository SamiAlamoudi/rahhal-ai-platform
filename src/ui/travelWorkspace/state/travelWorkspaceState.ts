import { isTravelWorkspaceEnabled } from '../travelWorkspaceRegistry'
import type {
  TravelWorkspaceLocale,
  TravelWorkspaceTheme,
  TravelWorkspaceUiState,
} from '../types'
import { TRAVEL_WORKSPACE_ISOLATION } from '../types'

export function createDemoTravelWorkspaceState(options?: {
  locale?: TravelWorkspaceLocale
  theme?: TravelWorkspaceTheme
  enabled?: boolean
}): TravelWorkspaceUiState {
  return {
    locale: options?.locale ?? 'ar',
    theme: options?.theme ?? 'light',
    trip: {
      destination: 'باريس',
      startDate: '2026-08-10',
      endDate: '2026-08-16',
      durationDays: 6,
      travelerCount: 2,
      status: 'confirmed',
      progressPercent: 35,
      budgetLabel: '18,500 SAR',
    },
    travelers: [
      {
        id: 'tr1',
        name: 'سامي',
        role: 'Primary',
        avatarInitials: 'سا',
        checkInStatus: 'ready',
        passportPlaceholder: true,
        seatPlaceholder: '12A',
        hotelRoomPlaceholder: '1204',
      },
      {
        id: 'tr2',
        name: 'نورة',
        role: 'Companion',
        avatarInitials: 'نو',
        checkInStatus: 'not_started',
        passportPlaceholder: true,
        seatPlaceholder: '12B',
        hotelRoomPlaceholder: '1204',
      },
    ],
    timeline: [
      {
        id: 'tl1',
        period: 'morning',
        title: 'مغادرة الرياض',
        timeLabel: '08:40',
        status: 'completed',
        kind: 'flight',
      },
      {
        id: 'tl2',
        period: 'afternoon',
        title: 'تسجيل الوصول للفندق',
        timeLabel: '15:00',
        status: 'upcoming',
        kind: 'hotel',
      },
      {
        id: 'tl3',
        period: 'evening',
        title: 'عشاء عمل',
        timeLabel: '20:00',
        status: 'upcoming',
        kind: 'meeting',
      },
      {
        id: 'tl4',
        period: 'afternoon',
        title: 'نقل للمطار',
        timeLabel: '13:30',
        status: 'delayed',
        kind: 'transport',
      },
    ],
    cards: [
      {
        id: 'c-flight',
        kind: 'flight',
        title: 'RUH → CDG',
        subtitle: 'SV123 · Economy',
        meta: '10 Aug · 08:40',
        statusLabel: 'On time',
      },
      {
        id: 'c-hotel',
        kind: 'hotel',
        title: 'Le Meurice',
        subtitle: 'Deluxe Room',
        meta: '10–16 Aug',
        statusLabel: 'Confirmed',
      },
      {
        id: 'c-transport',
        kind: 'transport',
        title: 'Airport transfer',
        subtitle: 'Private car',
        meta: 'CDG → Hotel',
        statusLabel: 'Scheduled',
      },
      {
        id: 'c-meeting',
        kind: 'meeting',
        title: 'Client briefing',
        subtitle: 'La Défense',
        meta: '11 Aug · 10:00',
        statusLabel: 'Upcoming',
      },
      {
        id: 'c-activity',
        kind: 'activity',
        title: 'Louvre visit',
        subtitle: 'Guided',
        meta: '12 Aug · 14:00',
        statusLabel: 'Booked',
      },
      {
        id: 'c-ticket',
        kind: 'ticket',
        title: 'Museum ticket',
        subtitle: 'E-ticket',
        meta: '#TK-9921',
        statusLabel: 'Ready',
      },
      {
        id: 'c-qr',
        kind: 'qr',
        title: 'Boarding QR',
        subtitle: 'Placeholder',
        meta: 'SV123',
        statusLabel: 'Available',
      },
      {
        id: 'c-board',
        kind: 'boarding_pass',
        title: 'Boarding pass',
        subtitle: 'Mobile',
        meta: 'Gate TBD',
        statusLabel: 'Placeholder',
      },
    ],
    documents: [
      { id: 'd1', labelKey: 'passport', kind: 'passport', placeholder: true },
      { id: 'd2', labelKey: 'visa', kind: 'visa', placeholder: true },
      { id: 'd3', labelKey: 'insurance', kind: 'insurance', placeholder: true },
      {
        id: 'd4',
        labelKey: 'hotel_voucher',
        kind: 'hotel_voucher',
        placeholder: true,
      },
      {
        id: 'd5',
        labelKey: 'flight_ticket',
        kind: 'flight_ticket',
        placeholder: true,
      },
      { id: 'd6', labelKey: 'meeting', kind: 'meeting', placeholder: true },
      { id: 'd7', labelKey: 'file', kind: 'file', placeholder: true },
    ],
    alerts: [
      {
        id: 'a1',
        severity: 'warning',
        message: 'Transfer may be delayed 20 minutes',
      },
      {
        id: 'a2',
        severity: 'info',
        message: 'Check-in opens 24h before departure',
      },
    ],
    checklist: [
      { id: 'ch1', label: 'Confirm seats', done: true },
      { id: 'ch2', label: 'Upload passport copies', done: false },
      { id: 'ch3', label: 'Share agenda with travelers', done: false },
    ],
    notes: [
      {
        id: 'n1',
        body: 'Prefer aisle seats · late checkout requested',
        updatedAt: '2026-07-24T10:00:00.000Z',
      },
    ],
    attachments: [
      { id: 'at1', name: 'agenda.pdf', kindLabel: 'PDF' },
      { id: 'at2', name: 'hotel-map.png', kindLabel: 'Image' },
    ],
    sharedItems: [
      { id: 'sh1', title: 'Trip itinerary', sharedWith: 'Team' },
    ],
    budget: {
      totalLabel: '18,500',
      spentLabel: '6,200',
      remainingLabel: '12,300',
      currencyCode: 'SAR',
    },
    statistics: {
      flights: 2,
      hotels: 1,
      meetings: 3,
      activities: 4,
      transfers: 2,
    },
    progressPhase: 'travel',
    featureEnabled: isTravelWorkspaceEnabled({ enabled: options?.enabled }),
  }
}

export function assertTravelWorkspaceIsolation(): typeof TRAVEL_WORKSPACE_ISOLATION & {
  ownDestination: boolean
  presentationOnly: boolean
} {
  return {
    ...TRAVEL_WORKSPACE_ISOLATION,
    ownDestination: true,
    presentationOnly: true,
  }
}
