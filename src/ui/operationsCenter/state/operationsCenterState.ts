import { isOperationsCenterEnabled } from '../operationsCenterRegistry'
import type {
  OperationsCenterLocale,
  OperationsCenterTheme,
  OperationsCenterUiState,
  OperationsFilterId,
} from '../types'
import { OPERATIONS_CENTER_ISOLATION } from '../types'

export function createDemoOperationsCenterState(options?: {
  locale?: OperationsCenterLocale
  theme?: OperationsCenterTheme
  enabled?: boolean
  activeFilter?: OperationsFilterId
}): OperationsCenterUiState {
  const locale = options?.locale ?? 'ar'
  const t = (ar: string, en: string) => (locale === 'en' ? en : ar)

  return {
    locale,
    theme: options?.theme ?? 'light',
    activeFilter: options?.activeFilter ?? 'all',
    searchQuery: '',
    overview: t(
      'مركز العمليات — مراقبة الرحلات والطوابير والحوادث. واجهة فقط بدون Runtime.',
      'Operations Center — monitor trips, queues, and incidents. Presentation only; no Runtime.',
    ),
    metrics: [
      {
        id: 'm1',
        label: t('نشطة', 'Active'),
        value: '14',
        trendLabel: t('+2 اليوم', '+2 today'),
      },
      {
        id: 'm2',
        label: t('متأخرة', 'Delayed'),
        value: '3',
        trendLabel: t('مرتفع', 'Elevated'),
      },
      {
        id: 'm3',
        label: t('حوادث', 'Incidents'),
        value: '2',
      },
      {
        id: 'm4',
        label: t('SLA', 'SLA'),
        value: '96%',
        trendLabel: t('مستقر', 'Stable'),
      },
    ],
    activeTrips: [
      {
        id: 'at1',
        title: t('باريس عائلي', 'Paris Family'),
        subtitle: 'JED → CDG',
        statusLabel: t('قيد التنفيذ', 'In progress'),
        priority: 'high',
        risk: 'medium',
      },
      {
        id: 'at2',
        title: t('دبي أعمال', 'Dubai Business'),
        subtitle: 'DXB stay',
        statusLabel: t('نشط', 'Active'),
        priority: 'medium',
        risk: 'low',
      },
    ],
    upcomingTrips: [
      {
        id: 'ut1',
        title: t('لندن', 'London'),
        subtitle: 'May 12',
        statusLabel: t('قادم', 'Upcoming'),
        priority: 'low',
        risk: 'low',
      },
    ],
    delayedTrips: [
      {
        id: 'dt1',
        title: 'SV 123',
        subtitle: t('تأخير 45 د', '45m delay'),
        statusLabel: t('متأخر', 'Delayed'),
        priority: 'critical',
        risk: 'high',
      },
    ],
    travelerRequests: [
      {
        id: 'tr1',
        name: t('سامي', 'Sami'),
        requestLabel: t('تغيير مقعد', 'Seat change'),
        priority: 'medium',
      },
      {
        id: 'tr2',
        name: t('نورة', 'Noura'),
        requestLabel: t('ترقية غرفة', 'Room upgrade'),
        priority: 'high',
      },
    ],
    supportQueue: [
      {
        id: 'sq1',
        title: t('استفسار فاتورة', 'Invoice inquiry'),
        meta: t('دعم', 'Support'),
        priority: 'medium',
        countLabel: '12m',
      },
    ],
    incidents: [
      {
        id: 'ic1',
        title: t('فقدان حقائب · CDG', 'Bag delay · CDG'),
        severityLabel: t('متوسط', 'Medium'),
        statusLabel: t('مفتوح', 'Open'),
      },
      {
        id: 'ic2',
        title: t('إلغاء فندق', 'Hotel cancellation'),
        severityLabel: t('مرتفع', 'High'),
        statusLabel: t('متابعة', 'Watch'),
      },
    ],
    emergencyItems: [
      {
        id: 'em1',
        title: t('مسافر يحتاج مساعدة طبية', 'Traveler needs medical assist'),
        severityLabel: t('حرج', 'Critical'),
        statusLabel: t('لوحة الطوارئ', 'Emergency board'),
      },
    ],
    approvalQueue: [
      {
        id: 'aq1',
        title: t('موافقة ميزانية أعمال', 'Business budget approval'),
        meta: '18,400 SAR',
        priority: 'high',
        countLabel: t('بانتظار', 'Pending'),
      },
    ],
    bookingQueue: [
      {
        id: 'bq1',
        title: t('إصدار تذكرة SV', 'Issue SV ticket'),
        meta: t('حجز', 'Booking'),
        priority: 'high',
        countLabel: '3',
      },
    ],
    visaQueue: [
      {
        id: 'vq1',
        title: t('شنغن · عائلة', 'Schengen · Family'),
        meta: t('تأشيرة', 'Visa'),
        priority: 'medium',
        countLabel: '2',
      },
    ],
    providers: [
      {
        id: 'pv1',
        name: 'Saudia',
        statusLabel: t('مستقر', 'Healthy'),
        slaLabel: '99.2%',
      },
      {
        id: 'pv2',
        name: 'Amadeus*',
        statusLabel: t('واجهة فقط', 'UI only'),
        slaLabel: '—',
      },
    ],
    slaMetrics: [
      {
        id: 'sla1',
        label: t('استجابة الدعم', 'Support response'),
        valueLabel: '8m',
        percent: 88,
      },
      {
        id: 'sla2',
        label: t('حل الحوادث', 'Incident resolve'),
        valueLabel: '2.4h',
        percent: 76,
      },
    ],
    agentWorkload: [
      {
        id: 'aw1',
        name: t('وكيل أ', 'Agent A'),
        loadLabel: '7 ' + t('مهام', 'tasks'),
        percent: 70,
      },
      {
        id: 'aw2',
        name: t('وكيل ب', 'Agent B'),
        loadLabel: '4 ' + t('مهام', 'tasks'),
        percent: 40,
      },
    ],
    notificationsQueue: [
      {
        id: 'nq1',
        title: t('تنبيه تأخير', 'Delay alert'),
        meta: t('واجهة فقط — لا إشعارات', 'UI only — no push'),
        priority: 'high',
        countLabel: '1',
      },
    ],
    activityFeed: [
      {
        id: 'af1',
        actor: t('وكيل أ', 'Agent A'),
        action: t('حدّث حالة الحادث', 'Updated incident status'),
      },
      {
        id: 'af2',
        actor: t('نظام', 'System'),
        action: t('أضاف طلب مسافر', 'Added traveler request'),
      },
    ],
    auditTimeline: [
      {
        id: 'au1',
        whenLabel: t('الآن', 'Now'),
        title: t('فتح مركز العمليات', 'Opened operations center'),
      },
      {
        id: 'au2',
        whenLabel: t('قبل 12 د', '12m ago'),
        title: t('اعتماد موافقة ميزانية', 'Budget approval recorded'),
      },
    ],
    calendarDays: ['12', '13', '14', '15', '16', '17', '18'],
    mapPlaceholder: t(
      'خريطة العمليات — واجهة فقط (لا خرائط)',
      'Operations map — placeholder (no maps)',
    ),
    chartPlaceholder: t(
      'مخططات العمليات — واجهة فقط',
      'Operations charts — placeholder',
    ),
    featureEnabled: isOperationsCenterEnabled({ enabled: options?.enabled }),
  }
}

export function assertOperationsCenterIsolation(): typeof OPERATIONS_CENTER_ISOLATION & {
  presentationOnly: boolean
} {
  return {
    ...OPERATIONS_CENTER_ISOLATION,
    presentationOnly: true,
  }
}
