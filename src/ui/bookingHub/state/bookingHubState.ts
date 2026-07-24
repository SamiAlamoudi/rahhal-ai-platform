import { isBookingHubEnabled } from '../bookingHubRegistry'
import type {
  BookingFilterId,
  BookingHubLocale,
  BookingHubTheme,
  BookingHubUiState,
} from '../types'
import { BOOKING_HUB_ISOLATION } from '../types'

export function createDemoBookingHubState(options?: {
  locale?: BookingHubLocale
  theme?: BookingHubTheme
  enabled?: boolean
  activeFilter?: BookingFilterId
}): BookingHubUiState {
  const locale = options?.locale ?? 'ar'
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar)

  return {
    locale,
    theme: options?.theme ?? 'light',
    activeFilter: options?.activeFilter ?? 'all',
    searchQuery: '',
    overview: t(
      'مركز الحجوزات — رحلاتك وخدماتك في مكان واحد. واجهة فقط بدون حجوزات أو مدفوعات.',
      'Booking Hub — your trips and services in one place. Presentation only; no live booking or payments.',
    ),
    stats: [
      { id: 's1', label: t('قادمة', 'Upcoming'), value: '3' },
      { id: 's2', label: t('مكتملة', 'Past'), value: '12' },
      { id: 's3', label: t('تذاكر', 'Tickets'), value: '8' },
      { id: 's4', label: t('إنفاق', 'Spend'), value: '64k' },
    ],
    upcomingTrips: [
      {
        id: 'u1',
        title: t('باريس عائلي', 'Paris Family'),
        subtitle: t('طيران + فندق', 'Flight + Hotel'),
        statusLabel: t('مؤكد · واجهة', 'Confirmed · UI'),
        dateLabel: '12–19 Apr',
      },
      {
        id: 'u2',
        title: t('دبي أعمال', 'Dubai Business'),
        subtitle: t('طيران فقط', 'Flight only'),
        statusLabel: t('مسودة · واجهة', 'Draft · UI'),
        dateLabel: '3–5 May',
      },
    ],
    pastTrips: [
      {
        id: 'p1',
        title: t('إسطنبول', 'Istanbul'),
        subtitle: t('مكتمل', 'Completed'),
        statusLabel: t('أرشيف', 'Archive'),
        dateLabel: 'Jan 2026',
      },
    ],
    flights: [
      {
        id: 'fl1',
        title: 'JED → CDG',
        meta: 'SV 123 · Economy',
        priceLabel: '4,200 SAR',
      },
      {
        id: 'fl2',
        title: 'DXB → JED',
        meta: 'EK 805 · Business',
        priceLabel: '3,100 SAR',
      },
    ],
    hotels: [
      {
        id: 'h1',
        title: 'Le Meurice',
        meta: t('باريس · 5 ليالٍ', 'Paris · 5 nights'),
        priceLabel: '12,800 SAR',
      },
    ],
    transportation: [
      {
        id: 'tr1',
        title: t('نقل المطار', 'Airport transfer'),
        meta: 'Private · CDG',
        priceLabel: '280 SAR',
      },
    ],
    cruises: [
      {
        id: 'cr1',
        title: t('متوسط · مسودة', 'Med · Draft'),
        meta: t('واجهة فقط', 'UI only'),
        priceLabel: '—',
      },
    ],
    trains: [
      {
        id: 'tn1',
        title: 'Paris → Lyon',
        meta: 'TGV · 2nd',
        priceLabel: '420 SAR',
      },
    ],
    activities: [
      {
        id: 'ac1',
        title: t('رحلة نهر السين', 'Seine cruise'),
        meta: t('عائلي', 'Family'),
        priceLabel: '640 SAR',
      },
    ],
    restaurants: [
      {
        id: 'rs1',
        title: 'L\'Ambroisie',
        meta: t('حجز طاولة · واجهة', 'Reservation · UI'),
        priceLabel: '—',
      },
    ],
    events: [
      {
        id: 'ev1',
        title: t('معرض باريس', 'Paris Expo'),
        meta: t('تذكرتان', '2 tickets'),
        priceLabel: '360 SAR',
      },
    ],
    insurance: [
      {
        id: 'in1',
        title: t('تأمين سفر عائلي', 'Family travel insurance'),
        meta: t('واجهة فقط', 'UI only'),
        priceLabel: '890 SAR',
      },
    ],
    visaStatus: [
      {
        id: 'vs1',
        title: t('شنغن · فرنسا', 'Schengen · France'),
        statusLabel: t('قيد المراجعة · واجهة', 'In review · UI'),
      },
    ],
    documents: [
      {
        id: 'd1',
        title: t('تأكيد الفندق', 'Hotel confirmation'),
        statusLabel: t('PDF · واجهة', 'PDF · UI'),
      },
    ],
    tickets: [
      {
        id: 'tk1',
        title: 'SV 123 eTicket',
        statusLabel: t('جاهز · واجهة', 'Ready · UI'),
      },
    ],
    invoices: [
      {
        id: 'iv1',
        title: t('فاتورة باريس', 'Paris invoice'),
        statusLabel: 'INV-2026-041',
      },
    ],
    refunds: [
      {
        id: 'rf1',
        title: t('استرداد جزئي EK', 'Partial EK refund'),
        statusLabel: t('قيد المعالجة · واجهة', 'Processing · UI'),
      },
    ],
    paymentSummaryLabel: t(
      'ملخص الدفع 21,890 SAR — واجهة فقط (لا مدفوعات)',
      'Payment summary 21,890 SAR — UI only (no payments)',
    ),
    travelerAssignments: [
      {
        id: 'ta1',
        traveler: t('سامي', 'Sami'),
        bookingLabel: 'JED → CDG',
      },
      {
        id: 'ta2',
        traveler: t('نورة', 'Noura'),
        bookingLabel: 'Le Meurice',
      },
    ],
    bookingTimeline: [
      {
        id: 'bt1',
        whenLabel: t('اليوم', 'Today'),
        title: t('تأكيد الفندق', 'Hotel confirmed'),
      },
      {
        id: 'bt2',
        whenLabel: t('أمس', 'Yesterday'),
        title: t('إصدار التذكرة', 'Ticket issued'),
      },
      {
        id: 'bt3',
        whenLabel: t('الأسبوع الماضي', 'Last week'),
        title: t('بدء البحث', 'Search started'),
      },
    ],
    priceBreakdown: [
      { id: 'pb1', label: t('طيران', 'Flights'), amountLabel: '7,300', percent: 33 },
      { id: 'pb2', label: t('فنادق', 'Hotels'), amountLabel: '12,800', percent: 59 },
      { id: 'pb3', label: t('أخرى', 'Other'), amountLabel: '1,790', percent: 8 },
    ],
    providers: [
      {
        id: 'pr1',
        name: 'Saudia',
        category: t('طيران', 'Airline'),
        statusLabel: t('واجهة فقط', 'UI only'),
      },
      {
        id: 'pr2',
        name: 'Booking.com',
        category: t('فنادق', 'Hotels'),
        statusLabel: t('واجهة فقط', 'UI only'),
      },
    ],
    calendarDays: ['12', '13', '14', '15', '16', '17', '18', '19'],
    mapPlaceholder: t(
      'خريطة الحجوزات — واجهة فقط (لا خرائط)',
      'Bookings map — placeholder (no maps)',
    ),
    favorites: [
      { id: 'fv1', name: 'Le Meurice', meta: t('فندق', 'Hotel') },
      { id: 'fv2', name: 'Saudia', meta: t('طيران', 'Airline') },
    ],
    bookmarks: [
      { id: 'bm1', name: t('مسودة دبي', 'Dubai draft'), meta: t('مثبّت', 'Pinned') },
    ],
    featureEnabled: isBookingHubEnabled({ enabled: options?.enabled }),
  }
}

export function assertBookingHubIsolation(): typeof BOOKING_HUB_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...BOOKING_HUB_ISOLATION,
    presentationOnly: true,
  }
}
